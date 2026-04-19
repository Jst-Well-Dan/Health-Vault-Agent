// Member detail screen backed by REST API data.

const HUMAN_TABS = ['概览', '指标趋势', '体检报告', '就医记录', '用药', '影像', '附件库', '提醒'];
const PET_TABS = ['概览', '驱虫周期', '疫苗接种', '就医记录', '体重趋势', '附件库', '提醒'];

const apiJson = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} · ${res.status}`);
  return res.json();
};

const extractNumber = (value) => {
  const n = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const formatValue = (value, digits = 1) => {
  const n = extractNumber(value);
  return n === null ? (value ?? '—') : Number(n.toFixed(digits)).toString();
};

const latestByName = (labs) => {
  const map = new Map();
  labs.forEach(lab => {
    const prev = map.get(lab.test_name);
    if (!prev || `${lab.date}-${lab.id}` > `${prev.date}-${prev.id}`) map.set(lab.test_name, lab);
  });
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
};

const refForLab = (lab) => {
  if (!lab) return null;
  const lo = extractNumber(lab.ref_low);
  const hi = extractNumber(lab.ref_high);
  if (lo !== null && hi !== null) return [lo, hi];
  if (hi !== null) return [0, hi];
  return null;
};

const reportFromVisit = (visit) => ({
  id: `visit-${visit.id}`,
  d: visit.date,
  t: visit.chief_complaint || (visit.diagnosis || []).join(' / ') || '就诊记录',
  org: [visit.hospital, visit.department].filter(Boolean).join(' · '),
  tag: '就医',
  abn: (visit.diagnosis || []).length ? visit.diagnosis : [visit.notes || '已记录'],
  file: visit.source_file || `visit-${visit.id}`,
});

const reportFromAttachment = (a) => ({
  id: `att-${a.id}`,
  d: a.date,
  t: a.title,
  org: a.org || '附件',
  tag: a.tag || '其他',
  abn: [a.notes || a.tag || '已归档'],
  file: a.filename || a.file_path || `attachment-${a.id}`,
  filePath: a.file_path,
});

const speciesText = (m, weights) => {
  if (!m) return '';
  if (!isPet(m)) return `${memberAge(m.birth_date)}岁 · ${m.sex || '未录性别'} · ${m.blood_type || '血型未录'} · ${(m.allergies || []).length ? `过敏: ${m.allergies.join('/')}` : '无过敏史'} · ${(m.chronic || []).length ? `慢病: ${m.chronic.join('/')}` : '无慢病'}`;
  const latestWeight = weights[weights.length - 1];
  const chip = m.chip_id ? ` · 芯片 ${m.chip_id}` : '';
  return `猫 · ${m.sex || '未录性别'} · ${memberAge(m.birth_date)}岁${latestWeight ? ` · ${formatValue(latestWeight.weight_kg)} kg` : ''}${chip}`;
};

/* ── Static enriched detail for known reports ──────────────── */
const DETAIL_EXTRA = {
  'TJ-2026-03188.pdf': {
    title: '年度体检报告',
    date: '2026-03-18', org: '三甲A 体检中心', doctor: '周医生',
    sections: [
      { name: '血脂四项', items: [
        { k: 'LDL-C', v: '3.8', u: 'mmol/L', ref: '< 3.4', warn: true },
        { k: 'HDL-C', v: '1.6', u: 'mmol/L', ref: '> 1.0', warn: false },
        { k: 'TC',    v: '5.4', u: 'mmol/L', ref: '< 5.2', warn: true },
        { k: 'TG',    v: '1.1', u: 'mmol/L', ref: '< 1.7', warn: false },
      ]},
      { name: '血常规', items: [
        { k: 'WBC', v: '6.2', u: '×10⁹/L',  ref: '4-10',    warn: false },
        { k: 'RBC', v: '4.4', u: '×10¹²/L', ref: '3.8-5.1', warn: false },
        { k: 'HGB', v: '128', u: 'g/L',      ref: '110-150', warn: false },
        { k: 'PLT', v: '210', u: '×10⁹/L',  ref: '100-300', warn: false },
      ]},
      { name: '肝功能', items: [
        { k: 'ALT',  v: '22', u: 'U/L',     ref: '< 40', warn: false },
        { k: 'AST',  v: '19', u: 'U/L',     ref: '< 40', warn: false },
        { k: 'TBIL', v: '12', u: 'μmol/L',  ref: '< 21', warn: false },
      ]},
    ],
    conclusion: '血脂中LDL-C及TC略高于参考上限，建议低脂饮食、减少饱和脂肪摄入，3个月后复查。其余项目未见明显异常。',
    ai: 'LDL-C 3.8 mmol/L，较2025年同期升高0.3，呈缓慢上升趋势。建议关注饮食结构，适量增加有氧运动。若3个月后复查仍≥3.4，考虑与医生讨论干预方案。',
  },
  'BP-0315.pdf': {
    title: '高血压社区复查',
    date: '2026-03-15', org: '社区卫生服务中心', doctor: '李医生',
    sections: [
      { name: '血压记录', items: [
        { k: '收缩压', v: '132', u: 'mmHg', ref: '< 140', warn: false },
        { k: '舒张压', v: '84',  u: 'mmHg', ref: '< 90',  warn: false },
        { k: '心率',   v: '72',  u: 'bpm',  ref: '60-100', warn: false },
      ]},
      { name: '当前用药', items: [
        { k: '氨氯地平', v: '5mg', u: '1次/日·早', ref: '按时服用', warn: false },
      ]},
    ],
    conclusion: '血压控制良好，维持现有用药方案。嘱低盐饮食，2个月后复诊。',
    ai: '收缩压132 mmHg，较上次（136）下降4个单位，控制趋势向好。继续氨氯地平5mg，保持低盐低脂饮食。',
  },
  'EN-0302.pdf': {
    title: '内分泌门诊记录',
    date: '2026-03-02', org: '三甲B 内分泌科', doctor: '王主任',
    sections: [
      { name: '糖尿病监测', items: [
        { k: 'HbA1c',    v: '7.1', u: '%',      ref: '< 6.5', warn: true },
        { k: '空腹血糖', v: '6.8', u: 'mmol/L', ref: '< 6.1', warn: true },
        { k: 'C肽',      v: '1.2', u: 'ng/mL',  ref: '0.9-4', warn: false },
      ]},
      { name: '用药调整', items: [
        { k: '二甲双胍',   v: '0.5g', u: '2次/日·餐时', ref: '继续', warn: false },
        { k: '阿托伐他汀', v: '10mg', u: '1次/日·睡前', ref: '新增', warn: false },
      ]},
    ],
    conclusion: 'HbA1c较上次（7.3%）有所下降，血糖控制改善，但仍高于目标值。新增阿托伐他汀调脂，3个月后复查HbA1c及血脂。',
    ai: 'HbA1c从7.6%降至7.1%，下降趋势明显，提示二甲双胍方案有效。继续关注饮食管理及规律运动，目标HbA1c < 7.0%。',
  },
  'PET-1214.pdf': {
    title: '猫咪年度体检',
    date: '2025-12-14', org: '宠爱动物医院', doctor: '陈兽医',
    sections: [
      { name: '血常规', items: [
        { k: 'WBC', v: '9.8',  u: '×10⁹/L',  ref: '5-19.5',  warn: false },
        { k: 'RBC', v: '8.1',  u: '×10¹²/L', ref: '5-10',    warn: false },
        { k: 'HGB', v: '122',  u: 'g/L',      ref: '80-150',  warn: false },
        { k: 'PLT', v: '312',  u: '×10⁹/L',  ref: '200-500', warn: false },
      ]},
      { name: '生化', items: [
        { k: 'BUN',  v: '8.2', u: 'mmol/L', ref: '7-28',   warn: false },
        { k: 'CREA', v: '85',  u: 'μmol/L', ref: '44-159', warn: false },
        { k: 'ALT',  v: '31',  u: 'U/L',    ref: '< 100',  warn: false },
      ]},
      { name: '体格检查', items: [
        { k: '体重',   v: '4.1',  u: 'kg', ref: '3.5-5.0', warn: false },
        { k: '体温',   v: '38.6', u: '°C', ref: '38-39.2', warn: false },
        { k: '牙结石', v: '轻度',  u: '',   ref: '定期洁牙', warn: true },
      ]},
    ],
    conclusion: '整体状况良好，血常规及生化均在正常范围。牙结石轻度，建议1年内进行一次牙科洁牙。下次年度体检 2026-12。',
    ai: '团子各项指标正常，肾功能良好（CREA 85），适合英短猫年龄。关注牙齿健康，建议预约洁牙。体重4.1 kg，处于理想区间。',
  },
};

/* ── Report Detail Drawer ───────────────────────────────────── */
const ReportDetail = ({ report, onClose }) => {
  const extra = DETAIL_EXTRA[report.file] || {};
  const title = extra.title || report.t;
  const date = extra.date || report.d;
  const org = extra.org || report.org;
  const doctor = extra.doctor || '—';
  const conclusion = extra.conclusion || (report.abn?.length ? report.abn.join('；') + '。' : '—');
  const ai = extra.ai || '暂无 AI 分析。';
  const sections = extra.sections || (
    report.abn?.length
      ? [{ name: '摘要', items: report.abn.map(a => ({ k: '结论', v: String(a), u: '', ref: '—', warn: String(a).includes('↑') || String(a).includes('高') })) }]
      : []
  );
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--paper)',
      zIndex: 20,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.22s ease',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(60px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      <div style={{
        padding: '14px 22px', borderBottom: '2px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--paper-2)', flexShrink: 0,
      }}>
        <div>
          <div className="mono" style={{ color: 'var(--ink-soft)' }}>
            {date} · {org} · {doctor}
          </div>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
            <Scribble>{title}</Scribble>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip variant="accent-3">{report.tag || '报告'}</Chip>
          <Stamp>{report.file}</Stamp>
          <Btn>打印</Btn>
          <Btn>下载</Btn>
          <Btn primary onClick={onClose}>← 返回</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div>
            <div className="ph" style={{ height: 320, borderRadius: 12, fontSize: 13 }}>
              [ {report.file} · 原始文件预览 ]<br />
              <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>点击可放大 · 支持 PDF / 图片</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Btn ghost>◀ 上一页</Btn>
              <span className="mono" style={{ padding: '4px 10px' }}>1 / 1</span>
              <Btn ghost>下一页 ▶</Btn>
              <div style={{ flex: 1 }} />
              <Btn ghost>🔍 放大</Btn>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sections.map((sec, si) => (
              <div key={si} className="sketch" style={{ padding: 14 }}>
                <div className="sec-label">{sec.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 110px', gap: 0 }}>
                  <div className="mono" style={{ color: 'var(--ink-ghost)', padding: '3px 0', fontSize: 9.5 }}>项目</div>
                  <div className="mono" style={{ color: 'var(--ink-ghost)', padding: '3px 0', fontSize: 9.5 }}>结果</div>
                  <div className="mono" style={{ color: 'var(--ink-ghost)', padding: '3px 0', fontSize: 9.5 }}>单位</div>
                  <div className="mono" style={{ color: 'var(--ink-ghost)', padding: '3px 0', fontSize: 9.5 }}>参考值</div>
                  {sec.items.map((item, ii) => [
                    <div key={`k${ii}`} style={{ padding: '5px 0', borderTop: '1px dashed var(--rule)', fontFamily: 'Caveat, cursive', fontSize: 18 }}>{item.k}</div>,
                    <div key={`v${ii}`} style={{ padding: '5px 0', borderTop: '1px dashed var(--rule)', fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700, color: item.warn ? 'var(--danger)' : 'var(--ink)' }}>{item.v}{item.warn ? ' ↑' : ''}</div>,
                    <div key={`u${ii}`} style={{ padding: '5px 0', borderTop: '1px dashed var(--rule)' }} className="mono">{item.u}</div>,
                    <div key={`r${ii}`} style={{ padding: '5px 0', borderTop: '1px dashed var(--rule)' }} className="mono">{item.ref}</div>,
                  ])}
                </div>
              </div>
            ))}
            {sections.length === 0 && (
              <div className="sketch" style={{ padding: 14 }}>
                <div className="sec-label">摘要</div>
                <div className="mono" style={{ color: 'var(--ink-soft)', padding: '10px 0' }}>暂无结构化数据</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid-2">
          <div className="sketch" style={{ padding: 14 }}>
            <div className="sec-label">医生结论</div>
            <div style={{ fontSize: 15, lineHeight: 1.7, marginTop: 6 }}>{conclusion}</div>
          </div>
          <div className="sketch" style={{ padding: 14, background: 'color-mix(in oklab, var(--accent) 14%, var(--paper))' }}>
            <div className="sec-label">AI 解读</div>
            <div style={{ fontSize: 15, lineHeight: 1.7, marginTop: 6 }}>
              <Scribble>AI</Scribble> · {ai}
            </div>
            <div style={{ marginTop: 10 }}>
              <Btn ghost>追问 AI →</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScreenMember = ({ members = [], memberKey, onChangeMember }) => {
  const member = members.find(f => f.key === memberKey) || members[0];
  const isCat = member ? isPet(member) : false;
  const TABS = isCat ? PET_TABS : HUMAN_TABS;
  const [tab, setTab] = React.useState('概览');
  const [detail, setDetail] = React.useState(null);
  const [data, setData] = React.useState({
    visits: [],
    labs: [],
    available: [],
    meds: [],
    weights: [],
    reminders: [],
    attachments: [],
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!TABS.includes(tab)) setTab('概览');
    setDetail(null);
  }, [member?.key, isCat]);

  React.useEffect(() => {
    if (!member?.key) return;
    let ignore = false;
    setLoading(true);
    setError('');
    Promise.all([
      apiJson(`/api/visits?member=${encodeURIComponent(member.key)}&limit=50`),
      apiJson(`/api/labs?member=${encodeURIComponent(member.key)}`),
      apiJson(`/api/labs/available?member=${encodeURIComponent(member.key)}`),
      apiJson(`/api/meds?member=${encodeURIComponent(member.key)}`),
      apiJson(`/api/weight?member=${encodeURIComponent(member.key)}`),
      apiJson(`/api/reminders?member=${encodeURIComponent(member.key)}`),
      apiJson(`/api/attachments?member=${encodeURIComponent(member.key)}`),
    ]).then(([visits, labs, available, meds, weights, reminders, attachments]) => {
      if (ignore) return;
      setData({
        visits: visits.items || [],
        labs,
        available,
        meds,
        weights,
        reminders,
        attachments,
      });
    }).catch(err => {
      if (!ignore) setError(err.message || '成员数据加载失败');
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [member?.key]);

  if (!member) {
    return <div className="sketch" style={{ padding: 40, textAlign: 'center' }}>正在读取成员档案...</div>;
  }

  const visitReports = data.visits.map(reportFromVisit);
  const attachmentReports = data.attachments.map(reportFromAttachment);
  const allReports = [...visitReports, ...attachmentReports].sort((a, b) => b.d.localeCompare(a.d));

  return (
    <div className="binder" style={{ boxShadow: '4px 4px 0 var(--line)' }}>
      <aside className="binder__side">
        <div className="sec-label">家庭 · Family</div>
        {members.map(f => (
          <div
            key={f.key}
            className={`rail-item ${f.key === member.key ? 'active' : ''}`}
            onClick={() => onChangeMember(f.key)}
          >
            <Avatar label={f.initial || f.name?.[0] || '?'} size="sm" cat={isPet(f)} ring={f.key === member.key} />
            <div style={{ lineHeight: 1.1, flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700 }}>{f.name}</div>
              <div className="mono" style={{ color: 'var(--ink-soft)', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {memberStatus(f)}
              </div>
            </div>
          </div>
        ))}
        <hr className="dash" />
        <Btn ghost style={{ width: '100%' }}>+ 添加成员</Btn>
      </aside>

      <div className="binder__body" style={{ position: 'relative' }}>
        <div style={{
          padding: '18px 22px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: '2px solid var(--line)',
          background: isCat ? 'color-mix(in oklab, var(--accent-3) 28%, var(--paper))' : 'var(--paper)',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Avatar label={member.initial || member.name?.[0] || '?'} size="xl" cat={isCat} ring={memberWarn(member) || isCat} />
            <div>
              <div className="mono" style={{ color: 'var(--ink-soft)' }}>
                {isCat ? '宠物档案 · ' : '档案 · '}{member.full_name || member.name}
              </div>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
                <Scribble>{member.name}</Scribble>
              </div>
              <div className="mono" style={{ color: 'var(--ink-soft)', marginTop: 6 }}>
                {speciesText(member, data.weights)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Stamp>API · LIVE</Stamp>
            <Btn>打印</Btn>
            <Btn>分享</Btn>
            <Btn primary>+ 新增记录</Btn>
          </div>
        </div>

        <div className="tabs-row">
          {TABS.map(t => (
            <div key={t} className={`t ${t === tab ? 'active' : ''}`} onClick={() => { setTab(t); setDetail(null); }}>{t}</div>
          ))}
        </div>

        <div style={{ padding: 22, background: 'var(--paper)' }}>
          {error && <div className="sketch" style={{ padding: 14, marginBottom: 14, color: 'var(--danger)' }}>{error}</div>}
          {loading && <div className="mono" style={{ marginBottom: 14, color: 'var(--ink-soft)' }}>正在同步成员数据...</div>}

          {!isCat && tab === '概览' && <TabOverview member={member} labs={data.labs} visits={data.visits} onOpen={setDetail} onOpenTrend={() => setTab('指标趋势')} />}
          {!isCat && tab === '指标趋势' && <TabTrend member={member} available={data.available} />}
          {!isCat && tab === '体检报告' && <TabReports reports={attachmentReports.filter(r => r.tag === '体检')} kind="体检" onOpen={setDetail} />}
          {!isCat && tab === '就医记录' && <TabReports reports={visitReports} kind="就医" onOpen={setDetail} />}
          {!isCat && tab === '用药' && <TabMeds meds={data.meds} />}
          {!isCat && tab === '影像' && <TabImaging reports={attachmentReports.filter(r => /\.(jpg|jpeg|png|webp|dcm)$/i.test(r.file))} onOpen={setDetail} />}
          {!isCat && tab === '附件库' && <TabAttachments reports={attachmentReports} onOpen={setDetail} />}
          {!isCat && tab === '提醒' && <TabReminders items={data.reminders} />}

          {isCat && tab === '概览' && <TabPetOverview member={member} labs={data.labs} weights={data.weights} attachments={data.attachments} />}
          {isCat && tab === '驱虫周期' && <TabDeworm reminders={data.reminders} attachments={data.attachments} />}
          {isCat && tab === '疫苗接种' && <TabVax labs={data.labs} attachments={data.attachments} />}
          {isCat && tab === '就医记录' && <TabReports reports={allReports.filter(r => r.tag === '就医' || r.tag === '体检')} kind="就医" onOpen={setDetail} />}
          {isCat && tab === '体重趋势' && <TabPetWeight member={member} weights={data.weights} />}
          {isCat && tab === '附件库' && <TabAttachments reports={attachmentReports} onOpen={setDetail} />}
          {isCat && tab === '提醒' && <TabReminders items={data.reminders} />}
        </div>

        {detail && <ReportDetail report={detail} onClose={() => setDetail(null)} />}
      </div>
    </div>
  );
};

const TabOverview = ({ member, labs, visits, onOpen, onOpenTrend }) => {
  const kpis = latestByName(labs).slice(0, 3);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <DashLabel>关键指标 · 最新</DashLabel>
        <span className="mono" style={{ color: 'var(--ink-soft)', cursor: 'pointer' }} onClick={onOpenTrend}>
          查看趋势 →
        </span>
      </div>
      {kpis.length === 0 ? (
        <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无检验指标</div>
      ) : (
        <div className="grid-3">
          {kpis.map(kp => {
            const ref = refForLab(kp);
            const warn = ['high', 'low', 'abnormal'].includes(kp.status);
            return (
              <div key={kp.id} className="tile" style={warn ? { background: 'color-mix(in oklab, var(--danger) 12%, var(--paper))' } : {}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="k">{kp.test_name}</span>
                  <span className="u">{ref ? `参考 ${ref[0]}-${ref[1]}` : kp.date}</span>
                </div>
                <div className="v" style={warn ? { color: 'var(--danger)' } : {}}>
                  {kp.value} <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{kp.unit || ''}</span>
                </div>
                <LineChart points={[extractNumber(kp.value) || 0, extractNumber(kp.value) || 0]} w={260} h={48} color={warn ? 'var(--danger)' : 'var(--ink)'} refBand={ref} />
              </div>
            );
          })}
        </div>
      )}

      <DashLabel>最近事件</DashLabel>
      <div className="row-list">
        {visits.slice(0, 4).map(v => (
          <div key={v.id} className="row">
            <span className="mono" style={{ color: 'var(--ink-soft)' }}>{v.date}</span>
            <div>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700 }}>{v.chief_complaint || '就诊记录'}</div>
              <span className="mono" style={{ color: 'var(--ink-soft)' }}>{v.hospital || '医疗机构'} · {(v.diagnosis || []).join(' / ') || v.notes || '已记录'}</span>
            </div>
            <Chip variant="accent">就医</Chip>
            <Btn ghost onClick={() => onOpen && onOpen(reportFromVisit(v))}>查看 →</Btn>
          </div>
        ))}
        {visits.length === 0 && <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无就诊记录</div>}
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="sketch" style={{ padding: 12 }}>
          <div className="sec-label">家庭医生</div>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 24 }}>{member.doctor || '未录入'}</div>
          <div className="mono" style={{ color: 'var(--ink-soft)' }}>下一提醒 · {member.next_reminder?.date || '暂无'}</div>
        </div>
        <div className="sketch" style={{ padding: 12 }}>
          <div className="sec-label">档案摘要</div>
          <div className="mono" style={{ lineHeight: 1.7 }}>
            过敏 {member.allergies?.length || 0} 项 · 慢病 {member.chronic?.length || 0} 项 · 指标 {labs.length} 条
          </div>
        </div>
      </div>
    </div>
  );
};

const TabTrend = ({ member, available }) => {
  const [selected, setSelected] = React.useState('');
  const [trend, setTrend] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const metrics = available || [];
  const active = selected || metrics[0]?.test_name || '';

  React.useEffect(() => {
    setSelected(metrics[0]?.test_name || '');
  }, [member.key, metrics.map(m => m.test_name).join('|')]);

  React.useEffect(() => {
    if (!active) {
      setTrend(null);
      return;
    }
    let ignore = false;
    setLoading(true);
    apiJson(`/api/labs/trend?member=${encodeURIComponent(member.key)}&test_name=${encodeURIComponent(active)}`)
      .then(data => { if (!ignore) setTrend(data); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [member.key, active]);

  if (!metrics.length) {
    return <div className="mono" style={{ color: 'var(--ink-soft)' }}>暂无记录达到 2 次以上的可追踪指标</div>;
  }

  const points = (trend?.points || []).map(p => p.value);
  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest != null && first != null ? latest - first : 0;
  const ref = trend ? refForLab({ ref_low: trend.ref_low, ref_high: trend.ref_high }) : null;
  const warn = ref && latest > ref[1];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {metrics.map(x => (
          <button key={`${x.test_name}-${x.panel}`} onClick={() => setSelected(x.test_name)}
            style={{
              fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700,
              padding: '5px 12px', border: '2px solid var(--line)', borderRadius: 8,
              background: x.test_name === active ? 'var(--ink)' : 'var(--paper)',
              color: x.test_name === active ? 'var(--paper)' : 'var(--ink)', cursor: 'pointer',
            }}>
            {x.test_name}
          </button>
        ))}
      </div>

      <div className="sketch" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div className="mono" style={{ color: 'var(--ink-soft)' }}>{member.name} · {active}</div>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 54, fontWeight: 700, lineHeight: 1 }}>
              {loading ? '...' : latest ?? '—'} <span style={{ fontSize: 20, color: 'var(--ink-soft)' }}>{trend?.unit || ''}</span>
            </div>
            <div className="mono" style={{ color: delta > 0 ? 'var(--danger)' : 'var(--ok)', marginTop: 4 }}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} {trend?.unit || ''} · 首末记录
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {ref && <Chip variant="accent-2">参考 {ref[0]}–{ref[1]} {trend?.unit || ''}</Chip>}
            <Chip>{points.length} 次记录</Chip>
            <Btn>导出</Btn>
          </div>
        </div>
        <LineChart points={points.length ? points : [0, 0]} w={1020} h={200} color={warn ? 'var(--danger)' : 'var(--ink)'} refBand={ref} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {(trend?.points || []).map(p => <span key={p.date} className="mono" style={{ color: 'var(--ink-soft)' }}>{p.date.slice(2)}</span>)}
        </div>
      </div>

      <div className="sketch" style={{ padding: 14, marginTop: 14, background: 'color-mix(in oklab, var(--accent) 12%, var(--paper))' }}>
        <div className="sec-label">摘要</div>
        <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
          <Scribble>{active}</Scribble> 当前共有 {points.length} 次记录，
          {Math.abs(delta) < 0.2 ? '整体基本稳定' : delta > 0 ? '较首次记录上升' : '较首次记录下降'}，
          {ref ? (warn ? '当前值高于参考区间。' : '当前值未高于参考上限。') : '暂无完整参考区间。'}
        </div>
      </div>
    </div>
  );
};

const TabReports = ({ reports, kind, onOpen }) => (
  <div>
    <DashLabel right={`${reports.length} 条`}>全部{kind}记录</DashLabel>
    {reports.length === 0 ? (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无 {kind} 记录</div>
    ) : (
      <div className="row-list">
        {reports.map(r => (
          <div key={r.id} className="row">
            <span className="mono" style={{ color: 'var(--ink-soft)' }}>{r.d}</span>
            <div>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700 }}>{r.t}</div>
              <span className="mono" style={{ color: 'var(--ink-soft)' }}>{r.org} · {r.file}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(r.abn || []).slice(0, 2).map((a, j) => <Chip key={j} variant={String(a).includes('高') || String(a).includes('↑') ? 'danger' : ''}>{a}</Chip>)}
            </div>
            <Btn ghost onClick={() => onOpen && onOpen(r)}>打开 →</Btn>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TabMeds = ({ meds }) => (
  <div>
    <DashLabel right={`${meds.length} 种`}>用药清单</DashLabel>
    {meds.length === 0 ? (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>无用药记录</div>
    ) : (
      <div className="grid-2">
        {meds.map(x => (
          <div key={x.id} className="sketch" style={{ padding: 14, background: x.ongoing ? 'var(--paper)' : 'var(--paper-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 26, fontWeight: 700 }}>{x.name}</div>
              <Chip variant={x.ongoing ? 'ok' : ''}>{x.ongoing ? '长期中' : '阶段性'}</Chip>
            </div>
            <div className="mono" style={{ color: 'var(--ink-soft)' }}>{[x.dose, x.route, x.freq].filter(Boolean).join(' · ') || '未录用法'}</div>
            <hr className="dash" />
            <div className="mono">开始 · {x.start_date || '未录'}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TabImaging = ({ reports, onOpen }) => (
  <div>
    <DashLabel right={`${reports.length} 份`}>影像资料</DashLabel>
    {reports.length === 0 ? (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无图片或影像附件</div>
    ) : (
      <div className="grid-4">
        {reports.map(r => (
          <div key={r.id} className="sketch" style={{ padding: 10, cursor: 'pointer' }} onClick={() => onOpen && onOpen(r)}>
            <Placeholder label={`[ ${r.file} ]`} h={120} />
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700, marginTop: 6 }}>{r.t}</div>
            <div className="mono" style={{ color: 'var(--ink-soft)' }}>{r.d} · {r.org}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TabAttachments = ({ reports, onOpen }) => (
  <div>
    <DashLabel right={`${reports.length} 份文件`}>附件库</DashLabel>
    <div className="grid-6">
      {reports.map(r => (
        <div key={r.id} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => onOpen && onOpen(r)}>
          <Placeholder label={r.file} h={90} />
          <div style={{ fontSize: 12, marginTop: 4 }}>{r.t}</div>
          <div className="mono" style={{ color: 'var(--ink-soft)' }}>{r.d}</div>
        </div>
      ))}
      <div style={{ textAlign: 'center' }}>
        <div style={{ border: '2px dashed var(--line)', borderRadius: 10, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat, cursive', fontSize: 22 }}>+ 上传</div>
      </div>
    </div>
  </div>
);

const TabReminders = ({ items }) => (
  <div>
    <DashLabel right={`${items.length} 条`}>我的提醒</DashLabel>
    {items.length === 0 ? (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>无提醒</div>
    ) : (
      <div className="row-list">
        {items.map(r => (
          <div key={r.id} className="row">
            <span className="mono">{r.date}</span>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700 }}>{r.title}</div>
            <Chip variant={r.kind === '宠物' || r.kind === '驱虫' ? 'accent-3' : r.kind === '就医' ? 'accent' : 'accent-2'}>{r.kind}</Chip>
            <Btn ghost>设置</Btn>
          </div>
        ))}
      </div>
    )}
  </div>
);

const TabPetOverview = ({ member, labs, weights, attachments }) => {
  const latestWeight = weights[weights.length - 1];
  const lastLabs = latestByName(labs).slice(0, 3);
  return (
    <div>
      <DashLabel>关键指标</DashLabel>
      <div className="grid-4">
        <Tile k="当前体重" v={latestWeight ? formatValue(latestWeight.weight_kg) : '—'} u="kg" trend={weights.slice(-6).map(w => w.weight_kg)} />
        {lastLabs.map(l => <Tile key={l.id} k={l.test_name} v={l.value} u={`${l.unit || ''} · ${l.date}`} warn={['high', 'low', 'abnormal'].includes(l.status)} />)}
        {lastLabs.length < 3 && <Tile k="附件" v={attachments.length} u="份文件" />}
      </div>
      <DashLabel>档案摘要</DashLabel>
      <div className="sketch" style={{ padding: 14 }}>
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 24 }}>{member.doctor || '未录入医院'}</div>
        <div className="mono" style={{ color: 'var(--ink-soft)' }}>{member.notes || '已接入 API 档案数据'}</div>
      </div>
    </div>
  );
};

const TabDeworm = ({ reminders, attachments }) => {
  const items = [
    ...reminders.filter(r => r.kind === '驱虫'),
    ...attachments.filter(a => a.tag === '驱虫').map(a => ({ id: `att-${a.id}`, date: a.date, title: a.title, kind: a.tag, done: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <DashLabel right={`${items.length} 条`}>驱虫记录</DashLabel>
      <TabReminders items={items.map(x => ({ id: x.id, date: x.date, title: x.title, kind: x.kind || '驱虫' }))} />
    </div>
  );
};

const TabVax = ({ labs, attachments }) => {
  const antibodyLabs = labs.filter(l => l.panel === '疫苗抗体');
  const vaccineFiles = attachments.filter(a => a.tag === '疫苗' || a.title.includes('免疫'));
  return (
    <div>
      <DashLabel right={`${antibodyLabs.length} 项`}>疫苗与抗体</DashLabel>
      <div className="row-list">
        {antibodyLabs.map(l => (
          <div key={l.id} className="row" style={{ gridTemplateColumns: '110px 1fr 110px 90px' }}>
            <span className="mono">{l.date}</span>
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700 }}>{l.test_name}</span>
            <Chip variant={l.status === 'normal' ? 'ok' : 'danger'}>{l.value}</Chip>
            <Btn ghost>查看</Btn>
          </div>
        ))}
      </div>
      <DashLabel right={`${vaccineFiles.length} 份`}>相关附件</DashLabel>
      <TabAttachments reports={vaccineFiles.map(reportFromAttachment)} />
    </div>
  );
};

const TabPetWeight = ({ member, weights }) => {
  const data = weights.map(w => w.weight_kg);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const delta = latest && first ? latest.weight_kg - first.weight_kg : 0;
  return (
    <div>
      <DashLabel right={`${weights.length} 条`}>体重曲线</DashLabel>
      <div className="sketch" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{latest ? formatValue(latest.weight_kg) : '—'} kg</div>
            <span className="mono" style={{ color: delta > 0 ? 'var(--danger)' : 'var(--ok)' }}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)} kg · 首末记录</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip variant="accent-2">{member.name}</Chip>
            <Chip>{first?.date || '—'} 至 {latest?.date || '—'}</Chip>
          </div>
        </div>
        <LineChart points={data.length > 1 ? data : [data[0] || 0, data[0] || 0]} w={1020} h={180} color="var(--accent)" refBand={null} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {weights.slice(-12).map(w => <span key={w.id} className="mono" style={{ color: 'var(--ink-soft)' }}>{w.date.slice(2, 7)}</span>)}
        </div>
      </div>
    </div>
  );
};

window.ScreenMember = ScreenMember;
