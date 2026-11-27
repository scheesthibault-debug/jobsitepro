/// <reference path="../pb_data/types.d.ts" />
/**
 * Bloque le pointage (time_entries) si l'employé a des documents sécurité
 * non signés avec requires_sign = true sur ses chantiers affectés.
 */

function employeeSiteIds(employeeId) {
  const ids = new Set();
  try {
    const rows = $app.findRecordsByFilter(
      'assignments',
      'employee = {:emp} && status = "active"',
      { emp: employeeId }
    );
    for (const row of rows) {
      const sid = row.get('site');
      if (sid) ids.add(String(sid));
    }
  } catch (err) {
    console.log('[safety_sign_clock_guard] assignments:', err);
  }
  return ids;
}

function signedDocumentIds(employeeId) {
  const ids = new Set();
  try {
    const rows = $app.findRecordsByFilter(
      'safety_signatures',
      'employee = {:emp}',
      { emp: employeeId }
    );
    for (const row of rows) {
      const docId = row.get('document');
      if (docId) ids.add(String(docId));
    }
  } catch (err) {
    console.log('[safety_sign_clock_guard] signatures:', err);
  }
  return ids;
}

function assertEmployeeSignedRequiredDocs(employeeId, companyId) {
  if (!employeeId || !companyId) return;

  const siteIds = employeeSiteIds(employeeId);
  if (!siteIds.size) return;

  const signed = signedDocumentIds(employeeId);
  let docs = [];
  try {
    docs = $app.findRecordsByFilter(
      'safety_documents',
      'company = {:co} && requires_sign = true',
      { co: companyId }
    );
  } catch (err) {
    console.log('[safety_sign_clock_guard] documents:', err);
    return;
  }

  for (const doc of docs) {
    const docId = doc.id;
    if (signed.has(docId)) continue;
    const site = doc.get('site');
    if (site && !siteIds.has(String(site))) continue;
    const title = String(doc.get('title') || docId);
    throw new ForbiddenError(
      'Document(s) à signer avant le pointage : ' + title
    );
  }
}

onRecordBeforeCreateRequest((e) => {
  if (e.collection.name !== 'time_entries') return;

  const user = e.httpContext?.get('authRecord');
  if (!user) return;

  const pbRole = String(user.get('role') || '').toLowerCase().trim();
  if (pbRole === 'admin' || pbRole === 'patron') return;

  const employeeId = String(e.record.get('employee') || user.id);
  const companyId = String(e.record.get('company') || user.get('company') || '');
  assertEmployeeSignedRequiredDocs(employeeId, companyId);
}, 'time_entries');
