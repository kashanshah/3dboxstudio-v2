export function AdminListSearch({ action, query, placeholder, hidden }: { action: string; query: string; placeholder: string; hidden?: Record<string, string> }) {
  return (
    <form className="admin-list-search" action={action}>
      {Object.entries(hidden ?? {}).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
      <input name="q" defaultValue={query} placeholder={placeholder} aria-label={placeholder} />
      <button className="admin-btn" type="submit">Search</button>
    </form>
  );
}
