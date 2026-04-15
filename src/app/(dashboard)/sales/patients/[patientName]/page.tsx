'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { PatientSaleHistoryResponse } from '@/types';
import s from './patient-history.module.scss';

const currency = (value: number | string) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-CA');
};

export default function PatientHistoryPage() {
  const params = useParams<{ patientName: string }>();
  const patientParam = typeof params?.patientName === 'string' ? params.patientName : '';
  const patientName = useMemo(() => decodeURIComponent(patientParam), [patientParam]);

  const [history, setHistory] = useState<PatientSaleHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientName) {
      setError('Patient name is missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    api.get<PatientSaleHistoryResponse>(`/sales/patients/${encodeURIComponent(patientName)}/history`)
      .then((res) => setHistory(res.data))
      .catch(() => {
        setHistory(null);
        setError('Failed to load patient history');
      })
      .finally(() => setLoading(false));
  }, [patientName]);

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <Link href="/sales" className={s.backLink}>Back to Sales</Link>
          <h1 className={s.title}>{history?.patientName || patientName || 'Patient History'}</h1>
          <p className={s.subtitle}>
            See every visit from the first recorded sale to the most recently updated one.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={s.stateCard}>Loading patient history...</div>
      ) : error ? (
        <div className={s.stateCard}>{error}</div>
      ) : !history ? (
        <div className={s.stateCard}>No history found for this patient.</div>
      ) : (
        <>
          <div className={s.summaryGrid}>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>First Visit</span>
              <strong className={s.summaryValue}>{formatDate(history.firstVisitDate)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Last Visit</span>
              <strong className={s.summaryValue}>{formatDate(history.lastVisitDate)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Total Visits</span>
              <strong className={s.summaryValue}>{history.totalVisits}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Last Updated</span>
              <strong className={s.summaryValue}>{formatDate(history.lastUpdatedAt)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Total Amount</span>
              <strong className={s.summaryValue}>{currency(history.totalAmount)}</strong>
            </div>
            <div className={s.summaryCard}>
              <span className={s.summaryLabel}>Pending Amount</span>
              <strong className={`${s.summaryValue} ${s.pendingValue}`}>{currency(history.totalPendingAmount)}</strong>
            </div>
          </div>

          <div className={s.timeline}>
            {history.visits.map((visit, index) => (
              <article key={visit.id} className={s.visitCard}>
                <div className={s.visitHeader}>
                  <div>
                    <p className={s.visitLabel}>Visit {index + 1}</p>
                    <h2 className={s.visitDate}>{formatDate(visit.date)}</h2>
                  </div>
                  <div className={s.visitMeta}>
                    <span className={s.statusBadge}>{visit.status}</span>
                    <span className={s.amount}>{currency(visit.amount)}</span>
                  </div>
                </div>

                <div className={s.visitGrid}>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Payment Mode</span>
                    <span className={s.metaValue}>{visit.paymentMode}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Pending</span>
                    <span className={`${s.metaValue} ${s.pendingText}`}>{currency(visit.pendingAmount)}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Products</span>
                    <span className={s.metaValue}>{visit.itemCount} {visit.itemCount === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className={s.metaBlock}>
                    <span className={s.metaLabel}>Updated</span>
                    <span className={s.metaValue}>{formatDate(visit.updatedAt)}</span>
                  </div>
                </div>

                <div className={s.medicineBlock}>
                  <h3 className={s.sectionTitle}>Medicines Given</h3>
                  {visit.products.length > 0 ? (
                    <div className={s.productList}>
                      {visit.products.map((product, productIndex) => (
                        <div key={`${visit.id}-${product.name}-${productIndex}`} className={s.productRow}>
                          <span className={s.productName}>{product.name}</span>
                          <span className={s.productQty}>x{product.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={s.emptyText}>No medicines recorded for this visit.</p>
                  )}

                  {visit.therapyPrice ? (
                    <div className={s.therapyRow}>
                      <span className={s.metaLabel}>Therapy</span>
                      <span className={s.metaValue}>{currency(visit.therapyPrice)}</span>
                    </div>
                  ) : null}
                </div>

                <div className={s.notesBlock}>
                  <h3 className={s.sectionTitle}>Notes</h3>
                  <p className={s.notesText}>{visit.notes || 'No notes added for this visit.'}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
