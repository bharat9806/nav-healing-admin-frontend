type ReportOptions = Parameters<typeof import('./generateWorkLogReport').generateWorkLogReport>[0];

export async function generateWorkLogReport(options: ReportOptions) {
  const reports = await import('./generateWorkLogReport');
  reports.generateWorkLogReport(options);
}
