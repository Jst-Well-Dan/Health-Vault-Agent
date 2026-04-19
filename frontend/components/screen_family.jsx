// Family overview screen backed by REST API data.

const TODAY = new Date('2026-04-19T00:00:00');

const numValue = (value) => {
  const n = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const memberAge = (birthDate) => {
  if (!birthDate) return '—';
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '—';
  let years = TODAY.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    TODAY.getMonth() < birth.getMonth() ||
    (TODAY.getMonth() === birth.getMonth() && TODAY.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return years;
};

const isPet = (m) => m.species && m.species !== 'human';

const memberStatus = (m) => {
  const highKpi = (m.latest_kpis || []).find(k => ['high', 'low', 'abnormal'].includes(k.status));
  if (highKpi) return `${highKpi.test_name} ${highKpi.value}${highKpi.unit || ''} · 需关注`;
  if ((m.chronic || []).length) return `${m.chronic.slice(0, 2).join(' / ')} · 记录中`;
  return isPet(m) ? '宠物档案 · 已建档' : '健康档案 · 已建档';
};

const memberWarn = (m) => {
  return (m.latest_kpis || []).some(k => ['high', 'low', 'abnormal'].includes(k.status));
};

const kpisForCard = (m) => {
  const kpis = (m.latest_kpis || []).slice(0, 3).map(k => ({
    k: k.test_name,
    v: k.value,
    u: k.unit || '',
    warn: ['high', 'low', 'abnormal'].includes(k.status),
  }));
  while (kpis.length < 3) {
    const fallback = kpis.length === 0 ? '记录' : kpis.length === 1 ? '慢病' : '过敏';
    const value = kpis.length === 0 ? '已建档' : kpis.length === 1 ? `${(m.chronic || []).length}` : `${(m.allergies || []).length}`;
    kpis.push({ k: fallback, v: value, u: '', warn: false });
  }
  return kpis;
};

const reminderWho = (members, key) => members.find(m => m.key === key);

const attachmentLabel = (a) => {
  const who = a.member_key || '家庭';
  const tag = a.tag || '附件';
  return `${tag} · ${who}`;
};

const ScreenFamily = ({ members = [], reminders = [], recentAttachments = [], loading = false, onOpenMember }) => {
  const total = members.length;
  const petCount = members.filter(isPet).length;
  const warns = members.filter(memberWarn).length;
  const upcoming = reminders.slice().sort((a, b) => a.date.localeCompare(b.date));
  const monthUploads = recentAttachments.filter(a => (a.date || '').startsWith('2026-04')).length || recentAttachments.length;

  if (loading && members.length === 0) {
    return <div className="sketch" style={{ padding: 40, textAlign: 'center' }}>正在读取家庭健康档案...</div>;
  }

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Tile k="家庭成员" v={total} u={`含 ${petCount} 只宠物`} />
        <Tile k="需要关注" v={warns} u="异常指标" warn={warns > 0} />
        <Tile k="未完成提醒" v={upcoming.length} u="条" />
        <Tile k="最近上传" v={monthUploads} u="份文件" />
      </div>

      <DashLabel right="点击打开成员档案">家人卡片</DashLabel>

      <div className="grid-3">
        {members.map((m, i) => {
          const warn = memberWarn(m);
          const next = m.next_reminder;
          return (
            <div
              key={m.key}
              className="sketch shadow"
              style={{
                padding: 14,
                transform: `rotate(${((i % 3) - 1) * 0.3}deg)`,
                cursor: 'pointer',
                background: warn ? 'color-mix(in oklab, var(--accent) 10%, var(--paper))' : 'var(--paper)',
              }}
              onClick={() => onOpenMember(m.key)}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <Avatar label={m.initial || m.name?.[0] || '?'} size="lg" cat={isPet(m)} ring={warn} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Caveat, cursive', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{m.name}</div>
                  <div className="mono" style={{ color: 'var(--ink-soft)', marginTop: 2 }}>
                    {m.role || '成员'} · {memberAge(m.birth_date)}岁{isPet(m) ? '(宠物)' : ''} · {m.blood_type || '血型未录'}
                  </div>
                </div>
                <Stamp>{warn ? '关注' : 'OK'}</Stamp>
              </div>

              <div style={{
                padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--line)',
                background: warn ? 'var(--accent)' : 'var(--paper-2)',
                fontSize: 14, marginBottom: 10,
              }}>
                {memberStatus(m)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                {kpisForCard(m).map((kp, idx) => (
                  <div key={`${kp.k}-${idx}`} style={{ border: '1.5px dashed var(--line)', borderRadius: 6, padding: '5px 7px' }}>
                    <div className="mono" style={{ color: 'var(--ink-soft)', fontSize: 9.5 }}>{kp.k}</div>
                    <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: kp.warn ? 'var(--danger)' : 'var(--ink)' }}>
                      {kp.v}{kp.warn ? ' ↑' : ''}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                <span className="mono" style={{ color: 'var(--ink-soft)' }}>下一事件</span>
                <span>{next ? `${next.title} · ` : '暂无提醒 · '}<span className="mono" style={{ color: 'var(--ink-soft)' }}>{next ? next.date.slice(5, 10) : '—'}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      <DashLabel>家庭日历 · 未完成提醒</DashLabel>

      <div className="grid-2">
        <div className="sketch" style={{ padding: 14 }}>
          <div className="sec-label">提醒清单</div>
          {upcoming.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无未完成提醒</div>
          ) : upcoming.map((r) => {
            const m = reminderWho(members, r.member_key) || {};
            const days = Math.ceil((new Date(`${r.date}T00:00:00`) - TODAY) / 864e5);
            return (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '60px 36px 1fr 70px 70px',
                alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1.5px dashed var(--rule)',
              }}>
                <span className="mono" style={{ color: days < 14 ? 'var(--danger)' : 'var(--ink-soft)' }}>
                  {days >= 0 ? `+${days}` : days}天
                </span>
                <Avatar label={m.initial || m.name?.[0] || '?'} size="xs" cat={isPet(m)} />
                <div>
                  <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{r.title}</div>
                  <span className="mono" style={{ color: 'var(--ink-soft)' }}>{m.name || r.member_key} · {r.date}</span>
                </div>
                <Chip variant={r.kind === '宠物' || r.kind === '驱虫' ? 'accent-3' : r.kind === '就医' ? 'accent' : 'accent-2'}>{r.kind}</Chip>
                <Btn ghost>查看</Btn>
              </div>
            );
          })}
        </div>

        <div className="sketch" style={{ padding: 14 }}>
          <div className="sec-label">最近上传</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
            {recentAttachments.map((a) => (
              <div key={a.id}>
                <Placeholder label={a.filename || a.title} h={72} />
                <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }}>{attachmentLabel(a)}</div>
              </div>
            ))}
            {recentAttachments.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: 'var(--ink-soft)' }}>暂无附件</div>
            )}
          </div>
          <hr className="dash" />
          <Btn primary style={{ width: '100%' }}>+ 上传新报告</Btn>
        </div>
      </div>
    </div>
  );
};

window.ScreenFamily = ScreenFamily;
