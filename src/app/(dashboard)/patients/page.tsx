'use client';

import Link from 'next/link';
import { isAxiosError } from 'axios';
import { useId, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { fetchCurrentUser } from '@/lib/current-user';
import { PatientDetail, PatientListItem, User } from '@/types';
import s from './patients.module.scss';

const interactionTypes = ['CALL', 'WHATSAPP', 'FOLLOW_UP', 'VISIT', 'NOTE'];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB');
};

const currency = (value: number | string) => `Rs. ${Number(value || 0).toFixed(2)}`;

export default function PatientsPage() {
  const fieldIds = useId();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showEditContactForm, setShowEditContactForm] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [patientFormError, setPatientFormError] = useState('');
  const [interactionFormError, setInteractionFormError] = useState('');
  const [editContactError, setEditContactError] = useState('');
  const [editContactForm, setEditContactForm] = useState({
    phone: '',
    alternatePhone: '',
    email: '',
  });
  const [patientForm, setPatientForm] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    email: '',
    notes: '',
  });
  const [interactionForm, setInteractionForm] = useState({
    interactionDate: new Date().toISOString().slice(0, 10),
    type: 'CALL',
    summary: '',
    notes: '',
  });

  const discardPatient = useUnsavedChanges(showPatientForm, patientForm);
  const discardNote = useUnsavedChanges(showInteractionForm, interactionForm);
  const discardContact = useUnsavedChanges(showEditContactForm, editContactForm);

  const canManagePatients = currentUser?.role === 'SUPER_ADMIN' || currentUser?.canManageSales;

  const [patientPage, setPatientPage] = useState(1);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientPages, setPatientPages] = useState(1);

  const patientRequest = useRef(0);
  const detailRequest = useRef(0);

  const loadPatients = async (query = search, nextSelectedPatientId?: number | null, requestedPage = 1, append = false) => {
    const requestId = ++patientRequest.current;
    setLoadingList(true);
    setListError('');

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      params.set('limit', '50');
      params.set('page', String(requestedPage));

      const res = await api.get<{ data: PatientListItem[]; meta?: { total: number; totalPages: number } }>(`/patients?${params.toString()}`);
      if (requestId !== patientRequest.current) return;
      const nextPatients = res.data.data || [];
      setPatients((previous) => append ? [...previous, ...nextPatients.filter((patient) => !previous.some((existing) => existing.id === patient.id))] : nextPatients);
      setPatientPage(requestedPage);
      setPatientTotal(res.data.meta?.total ?? nextPatients.length);
      setPatientPages(res.data.meta?.totalPages ?? 1);

      const selectedExists = nextPatients.some((patient) => patient.id === nextSelectedPatientId);
      const currentExists = nextPatients.some((patient) => patient.id === selectedPatientId);
      const resolvedSelectedId =
        selectedExists ? nextSelectedPatientId :
        currentExists ? selectedPatientId :
        nextPatients[0]?.id ?? null;

      if (!append) setSelectedPatientId(resolvedSelectedId ?? null);
    } catch {
      if (requestId !== patientRequest.current) return;
      if (!append) setPatients([]);
      setListError('Failed to load patients');
    } finally {
      if (requestId === patientRequest.current) setLoadingList(false);
    }
  };

  const loadPatientDetail = async (patientId: number) => {
    const requestId = ++detailRequest.current;
    setLoadingDetail(true);
    setDetailError('');

    try {
      const res = await api.get<PatientDetail>(`/patients/${patientId}`);
      if (requestId === detailRequest.current) setPatientDetail(res.data);
    } catch {
      if (requestId !== detailRequest.current) return;
      setPatientDetail(null);
      setDetailError('Failed to load patient details');
    } finally {
      if (requestId === detailRequest.current) setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser().then(setCurrentUser).catch(() => {});
    void loadPatients('');
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadPatients(search);
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setShowEditContactForm(false);
    setEditContactError('');

    if (!selectedPatientId) {
      setPatientDetail(null);
      return;
    }

    void loadPatientDetail(selectedPatientId);
  }, [selectedPatientId]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId],
  );

  const resetPatientForm = () => {
    setPatientForm({
      name: '',
      phone: '',
      alternatePhone: '',
      email: '',
      notes: '',
    });
    setPatientFormError('');
    setShowPatientForm(false);
  };

  const resetInteractionForm = () => {
    setInteractionForm({
      interactionDate: new Date().toISOString().slice(0, 10),
      type: 'CALL',
      summary: '',
      notes: '',
    });
    setInteractionFormError('');
    setShowInteractionForm(false);
  };

  const openEditContactForm = (detail: PatientDetail) => {
    setEditContactForm({
      phone: detail.phone || '',
      alternatePhone: detail.alternatePhone || '',
      email: detail.email || '',
    });
    setEditContactError('');
    setShowEditContactForm(true);
  };

  const resetEditContactForm = () => {
    setEditContactError('');
    setShowEditContactForm(false);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setSavingContact(true);
    setEditContactError('');

    try {
      await api.put(`/patients/${selectedPatientId}`, {
        phone: editContactForm.phone || null,
        alternatePhone: editContactForm.alternatePhone || null,
        email: editContactForm.email || null,
      });

      await Promise.all([
        loadPatients(search, selectedPatientId),
        loadPatientDetail(selectedPatientId),
      ]);
      resetEditContactForm();
    } catch (error) {
      const message = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      setEditContactError(Array.isArray(message) ? message.join(', ') : message || 'Failed to update contact details');
    } finally {
      setSavingContact(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPatient(true);
    setPatientFormError('');

    try {
      const res = await api.post<PatientListItem>('/patients', {
        name: patientForm.name,
        phone: patientForm.phone || undefined,
        alternatePhone: patientForm.alternatePhone || undefined,
        email: patientForm.email || undefined,
        notes: patientForm.notes || undefined,
      });

      resetPatientForm();
      await loadPatients(search, res.data.id);
    } catch (error) {
      const message = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      setPatientFormError(Array.isArray(message) ? message.join(', ') : message || 'Failed to create patient');
    } finally {
      setSavingPatient(false);
    }
  };

  const handleCreateInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    setSavingInteraction(true);
    setInteractionFormError('');

    try {
      await api.post(`/patients/${selectedPatientId}/interactions`, {
        interactionDate: interactionForm.interactionDate,
        type: interactionForm.type,
        summary: interactionForm.summary || undefined,
        notes: interactionForm.notes,
      });

      await Promise.all([
        loadPatients(search, selectedPatientId),
        loadPatientDetail(selectedPatientId),
      ]);
      resetInteractionForm();
    } catch (error) {
      const message = isAxiosError<{ message?: string | string[] }>(error)
        ? error.response?.data?.message
        : undefined;
      setInteractionFormError(Array.isArray(message) ? message.join(', ') : message || 'Failed to save patient note');
    } finally {
      setSavingInteraction(false);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.pageTitle}>Patients</h1>
          <p className={s.pageSubtitle}>
            Track every patient, note when they called, and save the conversation for the team.
          </p>
        </div>

        {canManagePatients ? (
          <button
            type="button"
            className={s.primaryButton}
            onClick={() => {
              if (showPatientForm && !discardPatient()) return;
              setShowPatientForm((current) => !current);
              setPatientFormError('');
            }}
          >
            {showPatientForm ? 'Close Form' : '+ Add Patient'}
          </button>
        ) : null}
      </div>

      {showPatientForm ? (
        <section className={s.formCard}>
          <div className={s.formHeader}>
            <div>
              <h2 className={s.formTitle}>Create patient</h2>
              <p className={s.formSubtitle}>Add a patient record so calls and notes stay in one place.</p>
            </div>
          </div>

          <form onSubmit={handleCreatePatient} className={s.formGrid}>
            <div className={s.formGroup}>
              <label htmlFor={`${fieldIds}-1`}>Patient Name</label>
              <input id={`${fieldIds}-1`}
                type="text"
                className={s.input}
                value={patientForm.name}
                onChange={(e) => setPatientForm((current) => ({ ...current, name: e.target.value }))}
                required
              />
            </div>
            <div className={s.formGroup}>
              <label htmlFor={`${fieldIds}-2`}>Phone</label>
              <input id={`${fieldIds}-2`}
                type="text"
                className={s.input}
                value={patientForm.phone}
                onChange={(e) => setPatientForm((current) => ({ ...current, phone: e.target.value }))}
              />
            </div>
            <div className={s.formGroup}>
              <label htmlFor={`${fieldIds}-3`}>Alternate Phone</label>
              <input id={`${fieldIds}-3`}
                type="text"
                className={s.input}
                value={patientForm.alternatePhone}
                onChange={(e) => setPatientForm((current) => ({ ...current, alternatePhone: e.target.value }))}
              />
            </div>
            <div className={s.formGroup}>
              <label htmlFor={`${fieldIds}-4`}>Email</label>
              <input id={`${fieldIds}-4`}
                type="email"
                className={s.input}
                value={patientForm.email}
                onChange={(e) => setPatientForm((current) => ({ ...current, email: e.target.value }))}
              />
            </div>
            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label htmlFor={`${fieldIds}-5`}>General Notes</label>
              <textarea id={`${fieldIds}-5`}
                className={s.textarea}
                rows={4}
                value={patientForm.notes}
                onChange={(e) => setPatientForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Any background details the team should know..."
              />
            </div>

            {patientFormError ? <p className={s.formError}>{patientFormError}</p> : null}

            <div className={s.formActions}>
              <button type="button" className={s.secondaryButton} onClick={() => { if (discardPatient()) resetPatientForm(); }}>
                Cancel
              </button>
              <button type="submit" className={s.primaryButton} disabled={savingPatient}>
                {savingPatient ? 'Saving...' : 'Save Patient'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.searchCard}>
            <input
              type="text"
              className={s.searchInput}
              placeholder="Search patient, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <p className={s.patientCount} role="status">Showing {patients.length} of {patientTotal} patients</p>
          {loadingList && patients.length === 0 ? (
            <div className={s.stateCard}>Loading patients...</div>
          ) : listError ? (
            <div className={s.stateCard}>{listError}</div>
          ) : patients.length === 0 ? (
            <div className={s.stateCard}>No patients found.</div>
          ) : (
            <div className={s.patientList}>
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className={`${s.patientListItem} ${patient.id === selectedPatientId ? s.patientListItemActive : ''}`}
                  onClick={() => setSelectedPatientId(patient.id)}
                >
                  <div className={s.patientListTop}>
                    <strong className={s.patientName}>{patient.name}</strong>
                    <span className={s.patientMeta}>
                      {patient.interactionCount} {patient.interactionCount === 1 ? 'note' : 'notes'}
                    </span>
                  </div>
                  <p className={s.patientContact}>{patient.phone || patient.email || 'No contact details yet'}</p>
                  <p className={s.patientTimestamp}>
                    Last note: {formatDate(patient.lastInteractionAt || patient.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
          {patientPage < patientPages && <button type="button" className={s.loadMore} disabled={loadingList} onClick={() => void loadPatients(search, selectedPatientId, patientPage + 1, true)}>{loadingList ? 'Loading…' : 'Load more patients'}</button>}
        </aside>

        <section className={s.detailPanel}>
          {!selectedPatientId ? (
            <div className={s.stateCard}>Select a patient to see their notes and history.</div>
          ) : loadingDetail ? (
            <div className={s.stateCard}>Loading patient details...</div>
          ) : detailError ? (
            <div className={s.stateCard}>{detailError}</div>
          ) : !patientDetail ? (
            <div className={s.stateCard}>Patient details are not available.</div>
          ) : (
            <>
              <div className={s.detailHeader}>
                <div>
                  <h2 className={s.detailTitle}>{patientDetail.name}</h2>
                  <p className={s.detailSubtitle}>
                    {patientDetail.phone || patientDetail.alternatePhone || patientDetail.email || 'No contact details saved yet'}
                  </p>
                </div>

                <div className={s.detailActions}>
                  {patientDetail.salesSummary.totalSales > 0 ? (
                    <Link href={`/sales/patients/${encodeURIComponent(patientDetail.name)}`} className={s.historyLink}>
                      View Sales History
                    </Link>
                  ) : null}
                  {canManagePatients ? (
                    <button
                      type="button"
                      className={s.primaryButton}
                      onClick={() => {
                        if (showInteractionForm && !discardNote()) return;
                        setShowInteractionForm((current) => !current);
                        setInteractionFormError('');
                      }}
                    >
                      {showInteractionForm ? 'Close Note Form' : '+ Add Call / Note'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={s.summaryGrid}>
                <div className={s.summaryCard}>
                  <span className={s.summaryLabel}>Total Notes</span>
                  <strong className={s.summaryValue}>{patientDetail.interactionCount}</strong>
                </div>
                <div className={s.summaryCard}>
                  <span className={s.summaryLabel}>Sales Entries</span>
                  <strong className={s.summaryValue}>{patientDetail.salesSummary.totalSales}</strong>
                </div>
                <div className={s.summaryCard}>
                  <span className={s.summaryLabel}>Total Amount</span>
                  <strong className={s.summaryValue}>{currency(patientDetail.salesSummary.totalAmount)}</strong>
                </div>
                <div className={s.summaryCard}>
                  <span className={s.summaryLabel}>Pending Amount</span>
                  <strong className={s.summaryValue}>{currency(patientDetail.salesSummary.totalPendingAmount)}</strong>
                </div>
              </div>

              <div className={s.profileGrid}>
                <div className={s.profileCard}>
                  <div className={s.cardTitleRow}>
                    <h3 className={s.cardTitle}>Patient Details</h3>
                    {canManagePatients ? (
                      <button
                        type="button"
                        className={s.editContactBtn}
                        onClick={() =>
                          showEditContactForm
                            ? (discardContact() && resetEditContactForm())
                            : openEditContactForm(patientDetail)
                        }
                      >
                        {showEditContactForm ? 'Cancel' : 'Edit'}
                      </button>
                    ) : null}
                  </div>

                  {showEditContactForm ? (
                    <form onSubmit={handleSaveContact} className={s.editContactForm}>
                      <div className={s.editContactField}>
                        <label htmlFor={`${fieldIds}-6`}>Phone</label>
                        <input id={`${fieldIds}-6`}
                          type="text"
                          className={s.input}
                          value={editContactForm.phone}
                          onChange={(e) =>
                            setEditContactForm((c) => ({ ...c, phone: e.target.value }))
                          }
                          placeholder="e.g. 9876543210"
                        />
                      </div>
                      <div className={s.editContactField}>
                        <label htmlFor={`${fieldIds}-7`}>Alternate Phone</label>
                        <input id={`${fieldIds}-7`}
                          type="text"
                          className={s.input}
                          value={editContactForm.alternatePhone}
                          onChange={(e) =>
                            setEditContactForm((c) => ({ ...c, alternatePhone: e.target.value }))
                          }
                          placeholder="e.g. 9876543211"
                        />
                      </div>
                      <div className={s.editContactField}>
                        <label htmlFor={`${fieldIds}-8`}>Email</label>
                        <input id={`${fieldIds}-8`}
                          type="email"
                          className={s.input}
                          value={editContactForm.email}
                          onChange={(e) =>
                            setEditContactForm((c) => ({ ...c, email: e.target.value }))
                          }
                          placeholder="patient@example.com"
                        />
                      </div>
                      {editContactError ? (
                        <p className={s.formError}>{editContactError}</p>
                      ) : null}
                      <div className={s.editContactActions}>
                        <button
                          type="button"
                          className={s.secondaryButton}
                          onClick={() => { if (discardContact()) resetEditContactForm(); }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={s.primaryButton}
                          disabled={savingContact}
                        >
                          {savingContact ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p><strong>Phone:</strong> {patientDetail.phone || '-'}</p>
                      <p><strong>Alternate:</strong> {patientDetail.alternatePhone || '-'}</p>
                      <p><strong>Email:</strong> {patientDetail.email || '-'}</p>
                      <p><strong>Created:</strong> {formatDate(patientDetail.createdAt)}</p>
                    </>
                  )}
                </div>

                <div className={s.profileCard}>
                  <h3 className={s.cardTitle}>General Notes</h3>
                  <p className={s.longText}>
                    {patientDetail.notes || selectedPatient?.notes || 'No general patient notes added yet.'}
                  </p>
                </div>
              </div>

              {showInteractionForm ? (
                <section className={s.formCard}>
                  <div className={s.formHeader}>
                    <div>
                      <h3 className={s.formTitle}>Log patient conversation</h3>
                      <p className={s.formSubtitle}>Example: customer called today and asked about delivery status.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateInteraction} className={s.formGrid}>
                    <div className={s.formGroup}>
                      <label htmlFor={`${fieldIds}-9`}>Date</label>
                      <input id={`${fieldIds}-9`}
                        type="date"
                        className={s.input}
                        value={interactionForm.interactionDate}
                        onChange={(e) => setInteractionForm((current) => ({ ...current, interactionDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className={s.formGroup}>
                      <label htmlFor={`${fieldIds}-10`}>Type</label>
                      <select id={`${fieldIds}-10`}
                        className={s.input}
                        value={interactionForm.type}
                        onChange={(e) => setInteractionForm((current) => ({ ...current, type: e.target.value }))}
                      >
                        {interactionTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`${s.formGroup} ${s.formGroupFull}`}>
                      <label htmlFor={`${fieldIds}-11`}>Short Summary</label>
                      <input id={`${fieldIds}-11`}
                        type="text"
                        className={s.input}
                        value={interactionForm.summary}
                        onChange={(e) => setInteractionForm((current) => ({ ...current, summary: e.target.value }))}
                        placeholder="Customer called today"
                      />
                    </div>
                    <div className={`${s.formGroup} ${s.formGroupFull}`}>
                      <label htmlFor={`${fieldIds}-12`}>Conversation Notes</label>
                      <textarea id={`${fieldIds}-12`}
                        className={s.textarea}
                        rows={5}
                        value={interactionForm.notes}
                        onChange={(e) => setInteractionForm((current) => ({ ...current, notes: e.target.value }))}
                        placeholder="Write what the patient asked, what the team answered, and any next step..."
                        required
                      />
                    </div>

                    {interactionFormError ? <p className={s.formError}>{interactionFormError}</p> : null}

                    <div className={s.formActions}>
                      <button type="button" className={s.secondaryButton} onClick={() => { if (discardNote()) resetInteractionForm(); }}>
                        Cancel
                      </button>
                      <button type="submit" className={s.primaryButton} disabled={savingInteraction}>
                        {savingInteraction ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              <div className={s.sectionGrid}>
                <section className={s.sectionCard}>
                  <div className={s.sectionHeader}>
                    <h3 className={s.sectionTitle}>Conversation Timeline</h3>
                  </div>

                  {patientDetail.interactions.length === 0 ? (
                    <p className={s.emptyText}>No call notes yet for this patient.</p>
                  ) : (
                    <div className={s.timeline}>
                      {patientDetail.interactions.map((interaction) => (
                        <article key={interaction.id} className={s.timelineCard}>
                          <div className={s.timelineTop}>
                            <div>
                              <span className={s.timelineType}>{interaction.type}</span>
                              <h4 className={s.timelineSummary}>{interaction.summary || 'Conversation note'}</h4>
                            </div>
                            <span className={s.timelineDate}>{formatDate(interaction.interactionDate)}</span>
                          </div>
                          <p className={s.longText}>{interaction.notes}</p>
                          <p className={s.timelineMeta}>
                            Added by {interaction.createdBy?.username || 'Team'} on {formatDate(interaction.createdAt)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className={s.sectionCard}>
                  <div className={s.sectionHeader}>
                    <h3 className={s.sectionTitle}>Recent Sales</h3>
                  </div>

                  {patientDetail.recentSales.length === 0 ? (
                    <p className={s.emptyText}>No sales history recorded yet for this patient.</p>
                  ) : (
                    <div className={s.salesList}>
                      {patientDetail.recentSales.map((sale) => (
                        <article key={sale.id} className={s.saleCard}>
                          <div className={s.saleTop}>
                            <strong>{formatDate(sale.date)}</strong>
                            <span className={s.saleAmount}>{currency(sale.amount)}</span>
                          </div>
                          <p className={s.saleMeta}>{sale.paymentMode} | {sale.status}</p>
                          <p className={s.saleMeta}>Pending: {currency(sale.pendingAmount)}</p>
                          <p className={s.longText}>{sale.notes || 'No sale notes added.'}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
