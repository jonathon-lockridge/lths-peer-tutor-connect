interface Subject {
  id: string;
  name: string;
  category: string;
}

interface Props {
  subjects: Subject[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
}

const CATEGORY_ORDER = [
  "MATH",
  "SCIENCE",
  "ENGLISH",
  "HISTORY",
  "WORLD_LANGUAGE",
  "ELECTIVE",
  "AP",
  "OTHER",
];

const CATEGORY_LABELS: Record<string, string> = {
  MATH: "Mathematics",
  SCIENCE: "Science",
  ENGLISH: "English",
  HISTORY: "Social Studies",
  WORLD_LANGUAGE: "World Languages",
  ELECTIVE: "Electives & CTE",
  AP: "Advanced Placement",
  OTHER: "Other",
};

function sortWithinGroup(subjects: Subject[]): Subject[] {
  return [...subjects].sort((a, b) => {
    const aAP = a.name.startsWith("AP ");
    const bAP = b.name.startsWith("AP ");
    const aPreAP = a.name.includes("Pre-AP");
    const bPreAP = b.name.includes("Pre-AP");
    if (aAP !== bAP) return aAP ? -1 : 1;
    if (aPreAP !== bPreAP) return aPreAP ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function GroupedSubjectSelect({
  subjects,
  value,
  onChange,
  placeholder = "Choose a subject…",
  className,
  includeAllOption = false,
}: Props) {
  const grouped: Record<string, Subject[]> = {};
  for (const s of subjects) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {includeAllOption ? (
        <option value="">All Subjects</option>
      ) : (
        <option value="">{placeholder}</option>
      )}
      {orderedCategories.map((cat) => (
        <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
          {sortWithinGroup(grouped[cat]).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
