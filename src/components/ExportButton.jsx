import { Download } from "lucide-react";
import { csvDownload } from "../lib/utils";

export default function ExportButton({ rows = [], filename, label = "Export CSV" }) {
  const handleExport = () => {
    if (!rows.length) return;
    csvDownload(rows, filename);
  };

  return (
    <button
      type="button"
      className="secondary page-export-button"
      onClick={handleExport}
      disabled={!rows.length}
      title={rows.length ? `Export ${filename}` : "No data to export"}
    >
      <Download size={15} />
      {label}
    </button>
  );
}
