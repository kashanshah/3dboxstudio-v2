'use client';

/** The designs list's template filter: choosing one applies it with the search, at once. */
export function AdminTemplateSelect({ value, options }: { value: string; options: { id: string; name: string; active: boolean }[] }) {
  return <select className="admin-template-select" name="template" defaultValue={value} aria-label="Template" onChange={event => event.currentTarget.form?.requestSubmit()}>
    <option value="">All templates</option>
    {options.map(option => <option key={option.id} value={option.id}>{option.name}{option.active ? '' : ' (inactive)'}</option>)}
  </select>;
}
