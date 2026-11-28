import { useState } from 'react';
import { QrCode, Smartphone, Share2, Star, Check, Copy, ExternalLink } from 'lucide-react';
import { formatMoney } from '../../utils/format.js';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

export default function SmartInvoiceQrCard({
  invoice,
  clinicName = 'ZhanX Dental Care',
  upiVpa = 'zhanxdental@okaxis',
  googleReviewUrl = 'https://g.page/r/zhanxdental/review'
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(Number(invoice.outstanding) > 0 ? 'upi' : 'review');

  const outstanding = Number(invoice.outstanding) || 0;
  const isPaid = outstanding <= 0 || invoice.status === 'paid';

  // NPCI Official UPI Format
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(clinicName)}&am=${outstanding}&cu=INR&tn=${encodeURIComponent('Bill ' + invoice.invoiceNo)}`;

  const upiQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}&margin=4`;
  const reviewQrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(googleReviewUrl)}&margin=4`;

  const copyUpiLink = () => {
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareInvoiceWhatsApp = () => {
    const text = encodeURIComponent(
      `*${clinicName} · Invoice & Payment Slip*\n\n` +
      `👤 *Patient:* ${invoice.patientName}\n` +
      `🧾 *Invoice No:* ${invoice.invoiceNo}\n` +
      `💰 *Total Amount:* ${formatMoney(invoice.total)}\n` +
      `💳 *Paid:* ${formatMoney(invoice.amountPaid)}\n` +
      `⚡ *Outstanding Balance:* ${formatMoney(invoice.outstanding)}\n\n` +
      (outstanding > 0
        ? `👉 *Scan to Pay via UPI (GPay/PhonePe/Paytm):*\n${upiUrl}\n\n`
        : `✅ *Status:* Paid in Full. Thank you!\n\n`) +
      `⭐ *Please share your review on Google:*\n${googleReviewUrl}\n\n` +
      `Thank you for trusting ${clinicName} with your dental health!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <Card noBody className="overflow-hidden border-teal-500/30 shadow-md">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 text-xs font-bold dark:border-slate-800 dark:bg-slate-850">
        <button
          type="button"
          onClick={() => setActiveTab('upi')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            activeTab === 'upi'
              ? 'border-[#009da6] text-[#009da6] dark:text-teal-300 bg-white dark:bg-slate-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Smartphone size={14} />
          <span>UPI Instant Pay</span>
          {!isPaid && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
            activeTab === 'review'
              ? 'border-[#009da6] text-[#009da6] dark:text-teal-300 bg-white dark:bg-slate-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Star size={14} className="text-amber-500 fill-amber-500" />
          <span>Google 5★ Review</span>
        </button>
      </div>

      <div className="p-4 text-center space-y-3">
        {activeTab === 'upi' ? (
          <div>
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-inner dark:border-slate-700">
              <img
                src={upiQrImg}
                alt="UPI Payment QR Code"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                <span>Scan with GPay / PhonePe / Paytm</span>
              </p>
              <p className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Amount: {formatMoney(outstanding)}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">VPA: {upiVpa}</p>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={copyUpiLink}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copied ? 'Copied Link!' : 'Copy UPI Link'}</span>
              </button>

              <button
                type="button"
                onClick={shareInvoiceWhatsApp}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500 shadow-sm transition cursor-pointer"
              >
                <Share2 size={13} />
                <span>WhatsApp Bill</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-amber-300/60 bg-white p-2 shadow-inner dark:border-amber-700/60">
              <img
                src={reviewQrImg}
                alt="Google Review QR Code"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-center gap-0.5 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} className="fill-amber-400" />
                ))}
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                Scan to Rate 5-Stars on Google!
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Helps new patients in Erode &amp; Kongu find our clinic.
              </p>
            </div>

            <div className="mt-3">
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <span>Open Review Page</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}