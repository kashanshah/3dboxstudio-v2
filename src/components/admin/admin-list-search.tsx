import Form from 'next/form';

// Searching navigates within the admin (no full page reload).
/** children: more filters, sent with the search. */
export function AdminListSearch({ action, query, placeholder, hidden, children }: { action: string; query: string; placeholder: string; hidden?: Record<string, string>; children?: React.ReactNode }) {
  return (
    <Form className="admin-list-search" action={action}>
      {Object.entries(hidden ?? {}).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
      <input name="q" defaultValue={query} placeholder={placeholder} aria-label={placeholder} />
      {children}
      <button className="admin-btn" type="submit">Search</button>
    </Form>
  );
}
