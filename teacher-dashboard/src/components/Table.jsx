const Table = ({ columns, data, emptyLabel = 'No records found.' }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
      <thead className="bg-slate-50 dark:bg-slate-900">
        <tr>
          {columns.map((column) => (
            <th key={column.accessor} className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {data.length > 0 ? (
          data.map((row) => (
            <tr key={row.id || JSON.stringify(row)} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
              {columns.map((column) => (
                <td key={column.accessor} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {column.cell ? column.cell(row[column.accessor], row) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default Table;
