import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BsEnvelope, BsGeoAlt, BsClock } from 'react-icons/bs';
import { z } from 'zod';
import Button from '@/components/Button';
import { TextField, TextAreaField } from '@/components/form/TextField';
import { useSubmitContactMutation } from './content.api';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/api/client';
import Faq from '@/components/Faq';

/**
 * Help and contact.
 *
 * Ported from `user/help.ejs` (878 lines, most of it inline CSS for an
 * accordion). The FAQ copy is carried across verbatim - it is the only real
 * content on the page - and the accordion is now a disclosure list rather than
 * a `toggleFAQ(this)` handler mutating classes.
 *
 * The contact form posts to the same endpoint as before; it was already JSON.
 */

const FAQS = [
  {
    q: 'What is your shipping policy?',
    a: 'We offer free shipping on all orders above ₹2,000 within India. For orders below ₹2,000, a delivery charge of ₹99-₹199 will be applied based on your location. Orders are typically processed within 1-2 business days and delivered within 5-7 business days depending on your location.'
  },
  {
    q: 'What is your return and exchange policy?',
    a: "We accept returns and exchanges within 7 days of delivery. Sneakers must be in original, unworn condition with all tags and packaging intact. Once we receive and inspect your return, we'll process your refund or exchange within 5-7 business days. Please note that original shipping charges are non-refundable."
  },
  {
    q: 'Do you accept Cash on Delivery (COD)?',
    a: 'Yes, we accept Cash on Delivery for orders below ₹10,000. For orders above ₹10,000, we only accept online payment methods including Credit/Debit Cards, UPI, Net Banking, and Digital Wallets. This policy helps us ensure secure transactions for high-value purchases.'
  },
  {
    q: 'How are delivery charges calculated?',
    a: 'Delivery charges are calculated based on your location and order value. For metropolitan cities, we charge ₹99 for orders below ₹2,000. For tier-2 and tier-3 cities, delivery charges range from ₹149-₹199. Orders above ₹2,000 qualify for free shipping nationwide. The exact delivery charge will be displayed during checkout before payment.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept multiple payment methods including Credit Cards (Visa, Mastercard, American Express), Debit Cards, UPI (Google Pay, PhonePe, Paytm), Net Banking, and Digital Wallets. For orders below ₹10,000, Cash on Delivery is also available. All online transactions are secured with industry-standard encryption.'
  },
  {
    q: 'How do I know if a sneaker is authentic?',
    a: 'Every sneaker at LacedUp is 100% authentic and sourced directly from authorized retailers and trusted suppliers. Each pair comes with original packaging, tags, and authentication certificates where applicable. We personally verify every sneaker before listing it on our platform. If you have any concerns about authenticity, please contact our support team.'
  },
  {
    q: 'How can I track my order?',
    a: "Once your order is shipped, you'll receive a tracking number via email and SMS. You can track your order in real-time by clicking the tracking link or visiting the \"My Orders\" section in your account. If you have any issues with tracking, our support team is here to help."
  },
  {
    q: 'Do you offer size exchanges?',
    a: "Yes, we offer size exchanges within 7 days of delivery, subject to availability. The sneakers must be unworn and in original condition with all tags attached. If your desired size is not available, we'll process a full refund. Exchange requests can be initiated through your account or by contacting our support team."
  },
  {
    q: 'What if my sneakers arrive damaged?',
    a: "If your sneakers arrive damaged or defective, please contact us within 48 hours of delivery with photos of the damage. We'll arrange for a free return pickup and either send you a replacement or process a full refund, including original shipping charges. Your satisfaction is our priority."
  },
  {
    q: 'Do you restock sold-out sneakers?',
    a: 'We try our best to restock popular models, but availability depends on our suppliers. You can sign up for restock notifications on product pages to get alerted when your desired sneakers are back in stock. For limited edition releases, we recommend acting fast as they sell out quickly.'
  }
];

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  email: z.string().trim().email('Please enter a valid email address'),
  subject: z.string().trim().min(3, 'Please enter a subject'),
  message: z.string().trim().min(10, 'Please tell us a little more')
});

type ContactValues = z.infer<typeof contactSchema>;

const HelpPage = () => {
  const [submitContact, { isLoading }] = useSubmitContactMutation();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactValues) => {
    try {
      const result = await submitContact(values).unwrap();
      toast.success(result.message ?? 'Message sent.');
      reset();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="text-center">
        <h1 className="font-heading text-3xl font-semibold text-ink">Frequently asked questions</h1>
        <p className="mt-2 text-ink-muted">Find answers to common questions about LacedUp.</p>
      </header>

      <section className="mt-8 rounded-lg border border-line bg-white px-5">
        {FAQS.map((faq) => (
          <Faq key={faq.q} question={faq.q} answer={faq.a} />
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-semibold text-ink">Still have questions?</h2>
        <p className="mt-2 text-ink-muted">
          Our team is here to help you with any questions or concerns about your sneaker journey.
        </p>

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-5">
            <li className="flex gap-3">
              <BsGeoAlt className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">Visit us</span>
                <span className="text-sm text-ink-muted">Kanayannur, Kerala, India</span>
              </span>
            </li>
            <li className="flex gap-3">
              <BsEnvelope className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">Email us</span>
                <a
                  href="mailto:support@lacedup.com"
                  className="text-sm text-ink-muted underline-offset-2 hover:text-brand hover:underline"
                >
                  support@lacedup.com
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <BsClock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">Response time</span>
                <span className="text-sm text-ink-muted">We typically respond within 24 hours</span>
              </span>
            </li>
          </ul>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <TextField
              label="Full name"
              required
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label="Email address"
              type="email"
              required
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Subject"
              required
              error={errors.subject?.message}
              {...register('subject')}
            />
            <TextAreaField
              label="Message"
              required
              rows={5}
              error={errors.message?.message}
              {...register('message')}
            />

            <Button type="submit" loading={isLoading} fullWidth>
              Send message
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default HelpPage;
