import { api } from '../api';
import { useAuth, useToast } from '../context';
import { FormModal } from './ui';
import { money } from '../utils';

/** Lump-sum payment from a vendor, applied to the oldest invoices first. */
export default function VendorPaymentForm({ vendor, onClose, onSaved }) {
  const { meta } = useAuth();
  const toast = useToast();
  return (
    <FormModal
      title={`Payment from ${vendor.vendor_name}`} submitLabel="Record payment" values={{ amount: vendor.outstanding_balance || '' }} onClose={onClose}
      fields={[
        { name: 'amount', label: 'Amount (M)', type: 'number', step: '0.01', min: 0, required: true, hint: `Outstanding: ${money(vendor.outstanding_balance)}. Applied to the oldest invoices first.` },
        { name: 'payment_method', label: 'Method', type: 'select', options: meta.payment_methods, required: true, placeholder: 'Choose method' }, { name: 'reference_number', label: 'Reference (mobile money code)' }
      ]}
      onSubmit={async (d) => { const r = await api(`/vendors/${vendor.vendor_id}/payments`, { method: 'POST', body: d }); toast('Payment recorded', 'ok', `Remaining balance ${money(r.data.remaining_balance)}`); onSaved(); }}
    />
  );
}
