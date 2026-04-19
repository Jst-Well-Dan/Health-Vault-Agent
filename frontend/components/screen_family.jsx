// Family overview screen backed by members table data.

const FAMILY_TODAY = new Date('2026-04-19T00:00:00');

const parseDate = (date) => {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const familyDaysSince = (fromDate, toDate = FAMILY_TODAY) => {
  const from = parseDate(fromDate);
  if (!from) return null;
  return Math.max(0, Math.floor((toDate - from) / 864e5));
};

const memberAge = (birthDate) => {
  const birth = parseDate(birthDate);
  if (!birth) return '—';
  let years = FAMILY_TODAY.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    FAMILY_TODAY.getMonth() < birth.getMonth() ||
    (FAMILY_TODAY.getMonth() === birth.getMonth() && FAMILY_TODAY.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return years;
};

const petAgeText = (birthDate) => {
  const birth = parseDate(birthDate);
  if (!birth) return '年龄未录';
  let months = (FAMILY_TODAY.getFullYear() - birth.getFullYear()) * 12 + FAMILY_TODAY.getMonth() - birth.getMonth();
  if (FAMILY_TODAY.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years <= 0) return `${rest}个月`;
  if (rest === 0) return `${years}岁`;
  return `${years}岁${rest}个月`;
};

const humanAgeText = (birthDate) => {
  const age = memberAge(birthDate);
  return age === '—' ? '年龄未录' : `${age}岁`;
};

const isPet = (m) => m.species && m.species !== 'human';

const speciesLabel = (m) => {
  if (!isPet(m)) return '家庭成员';
  if (m.species === 'cat') return '猫咪';
  return m.species || '宠物';
};

const compactDate = (date) => date ? date.replaceAll('-', '.') : '未录';

const memberStatus = (m) => {
  if (isPet(m)) {
    const homeDays = familyDaysSince(m.home_date);
    return `${speciesLabel(m)} · ${petAgeText(m.birth_date)}${homeDays === null ? '' : ` · 到家${homeDays}天`}`;
  }
  const tags = [m.role || '成员', m.sex, humanAgeText(m.birth_date)].filter(Boolean);
  return tags.join(' · ');
};

const memberWarn = () => false;

const memberMeta = (m) => {
  if (isPet(m)) {
    return [m.breed || speciesLabel(m), m.sex, petAgeText(m.birth_date)].filter(Boolean).join(' · ');
  }
  return [m.role || '家庭成员', m.sex, humanAgeText(m.birth_date)].filter(Boolean).join(' · ');
};

const memberStats = (m) => {
  if (isPet(m)) {
    const homeDays = familyDaysSince(m.home_date);
    return [
      { k: '品种', v: m.breed || '未录' },
      { k: '年龄', v: petAgeText(m.birth_date) },
      { k: '到家', v: homeDays === null ? '未录' : `${homeDays}天` },
    ];
  }
  return [
    { k: '身份', v: m.role || '成员' },
    { k: '年龄', v: humanAgeText(m.birth_date) },
    { k: '出生', v: familyDaysSince(m.birth_date) === null ? '未录' : `${familyDaysSince(m.birth_date)}天` },
  ];
};

const memberNote = (m) => {
  if (m.notes) return m.notes;
  if (isPet(m)) return `${m.name} 的基础档案。`;
  return `${m.role || '家庭成员'}，暂无备注。`;
};

const ScreenFamily = ({ members = [], loading = false, onOpenMember }) => {
  const people = members.filter(m => !isPet(m)).length;
  const pets = members.filter(isPet).length;

  if (loading && members.length === 0) {
    return <div className="sketch" style={{ padding: 40, textAlign: 'center' }}>正在读取家庭成员...</div>;
  }

  return (
    <div className="family-simple">
      <section className="family-simple__summary sketch">
        <div>
          <div className="sec-label">家庭成员</div>
          <div className="family-simple__title">{members.length} 位成员</div>
        </div>
        <div className="family-simple__counts">
          <span>{people} 位家人</span>
          <span>{pets} 只宠物</span>
        </div>
      </section>

      <DashLabel right="点击打开成员档案">家人卡片</DashLabel>

      <div className="family-card-grid family-card-grid--simple">
        {members.map((m, i) => {
          const humanColors = ['hue-amber', 'hue-rose', 'hue-sky', 'hue-sage', 'hue-violet'];
          const colorCls = isPet(m) ? 'pet' : humanColors[i % humanColors.length];
          return (
          <button
            key={m.key}
            type="button"
            className={`family-member-card sketch shadow ${colorCls}`}
            style={{ transform: `rotate(${((i % 3) - 1) * 0.2}deg)` }}
            onClick={() => onOpenMember(m.key)}
          >
            <div className="family-member-card__head">
              <Avatar label={m.initial || m.name?.[0] || '?'} size="lg" cat={isPet(m)} ring={false} />
              <div className="family-member-card__identity">
                <div className="family-member-card__name">{m.name}</div>
                <div className="mono">{memberMeta(m)}</div>
              </div>
              <Stamp>{isPet(m) ? speciesLabel(m) : (m.role || '成员')}</Stamp>
            </div>


            <div className="family-profile-stats">
              {memberStats(m).map(item => (
                <div key={item.k}>
                  <span className="mono">{item.k}</span>
                  <strong>{item.v}</strong>
                </div>
              ))}
            </div>

            <div className="family-profile-note">
              <span className="mono">备注</span>
              <p>{memberNote(m)}</p>
            </div>

            <div className="family-card-foot">
              <span className="mono">{isPet(m) ? '到家日' : '生日'}</span>
              <strong>{compactDate(isPet(m) ? m.home_date : m.birth_date)}</strong>
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
};

window.ScreenFamily = ScreenFamily;
