export default function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-label="Loading admin data">
      <div className="admin-loading-heading">
        <span />
        <strong />
        <i />
      </div>
      <div className="admin-loading-grid">
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
      </div>
      <div className="admin-loading-panel" />
      <span className="sr-only">Loading admin data…</span>
    </div>
  );
}
