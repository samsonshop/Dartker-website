/**
 * Policy copy lives in one place so the pages, the FAQ and the checkout all
 * quote the same terms. Replace the placeholders marked "[merchant]" with your
 * registered details before going live.
 */
export interface PolicySection {
  heading: string;
  body: string[];
}

export interface PolicyDocument {
  slug: string;
  title: string;
  summary: string;
  updated: string;
  sections: PolicySection[];
}

export const POLICIES: PolicyDocument[] = [
  {
    slug: 'shipping',
    title: 'Shipping Policy',
    summary: 'How and when Dartler orders reach you.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Where we ship',
        body: [
          'We ship across India through Delhivery. You can check whether we deliver to your pincode on the Track Order page before you place an order.',
        ],
      },
      {
        heading: 'Dispatch time',
        body: [
          'Orders placed before 2 pm on a working day are usually packed and handed to the courier the same day. Orders placed after that, or on a Sunday or public holiday, go out on the next working day.',
        ],
      },
      {
        heading: 'Delivery time',
        body: [
          'Metro cities: 2–4 working days. Other cities and towns: 4–7 working days. Remote pincodes can take a little longer, and the courier will show the current estimate on your tracking page.',
        ],
      },
      {
        heading: 'Shipping charges',
        body: [
          'Shipping is free on orders above ₹999. Below that, a flat ₹49 applies. Cash on Delivery is available on serviceable pincodes at no extra charge.',
        ],
      },
      {
        heading: 'If something goes wrong',
        body: [
          'If a parcel is delayed beyond the estimate, or arrives damaged, write to info@dartler.com with your order number and a photograph within 48 hours of delivery and we will replace or refund it.',
        ],
      },
    ],
  },
  {
    slug: 'returns',
    title: 'Return & Refund Policy',
    summary: 'Seven days to change your mind, on almost everything.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Return window',
        body: [
          'You can raise a return within 7 days of delivery from your account, under Returns & cancellations. The item should be unused, with its tags and original packaging intact.',
        ],
      },
      {
        heading: 'What cannot be returned',
        body: [
          'For hygiene reasons, used makeup brushes and opened cosmetic accessories cannot be returned unless they arrived damaged or faulty. Items bought during a clearance sale are exchange-only.',
        ],
      },
      {
        heading: 'Cancellations',
        body: [
          'An order can be cancelled from your account any time before it is dispatched. Once the courier has picked it up, please raise a return instead.',
        ],
      },
      {
        heading: 'Refunds',
        body: [
          'Prepaid orders are refunded to the original payment method within 5–7 working days of the returned parcel reaching us. Cash on Delivery orders are refunded by bank transfer to the account you nominate.',
        ],
      },
      {
        heading: 'Return shipping',
        body: [
          'If the return is because of a damaged, defective or wrong item, we arrange and pay for the reverse pickup. For a change of mind, a ₹49 reverse-shipping fee is deducted from the refund.',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    summary: 'The agreement between you and Dartler.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'About these terms',
        body: [
          'By using dartler.com or placing an order, you agree to these terms. They are governed by Indian law, and any dispute is subject to the jurisdiction of the courts at Coimbatore, Tamil Nadu.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You are responsible for keeping your password confidential and for activity under your account. Tell us at once if you think someone else has access.',
        ],
      },
      {
        heading: 'Pricing and availability',
        body: [
          'All prices are in Indian Rupees and include GST unless stated otherwise. Prices and stock can change without notice. If an item becomes unavailable after you order, we will contact you and refund it in full.',
        ],
      },
      {
        heading: 'Orders we may decline',
        body: [
          'We may decline or cancel an order where there is an obvious pricing error, where stock is unavailable, or where we suspect fraudulent use of a payment method.',
        ],
      },
      {
        heading: 'Intellectual property',
        body: [
          'The Dartler name, logo, product photography and site content belong to [merchant legal entity]. Please do not reuse them without written permission.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What we collect, why, and how long we keep it.',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'To fulfil an order we collect your name, email, phone number and delivery address. We also keep a record of your orders, returns and support conversations.',
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Card and UPI details are handled entirely by Razorpay, our payment gateway. Dartler never sees or stores your full card number, UPI PIN or CVV.',
        ],
      },
      {
        heading: 'Analytics',
        body: [
          'We count visits using an anonymous identifier stored in a cookie. It is not linked to your name or email and is used only to understand how many people visit and how many go on to order.',
        ],
      },
      {
        heading: 'Who we share with',
        body: [
          'Your delivery address and phone number are shared with Delhivery so they can deliver your parcel. We do not sell personal data to anyone.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can update or delete your address book from your account at any time, and unsubscribe from marketing email with one click. To ask for your account to be deleted, write to info@dartler.com.',
        ],
      },
    ],
  },
];

export const FAQS: { question: string; answer: string }[] = [
  {
    question: 'How long will my order take to arrive?',
    answer:
      'Two to four working days to metro cities, four to seven elsewhere. You will get a tracking link as soon as the courier picks up your parcel, and you can follow it on the Track Order page at any time.',
  },
  {
    question: 'Do you offer Cash on Delivery?',
    answer:
      'Yes, on every serviceable pincode, at no extra charge. You can also pay by UPI, card or net banking at checkout.',
  },
  {
    question: 'How do I return something?',
    answer:
      'Sign in, open Returns & cancellations in your account, and raise a request within 7 days of delivery. We review it the same day and arrange a reverse pickup where it applies.',
  },
  {
    question: 'When will I get my refund?',
    answer:
      'Within 5–7 working days of the returned parcel reaching us. Prepaid orders go back to the original payment method; Cash on Delivery orders are refunded by bank transfer.',
  },
  {
    question: 'Can I change my delivery address after ordering?',
    answer:
      'Yes, if the order has not been dispatched. Email info@dartler.com with your order number and the new address, and we will update it before it ships.',
  },
  {
    question: 'Are the products genuine and covered by a warranty?',
    answer:
      'Everything is sourced directly and shipped from our own studio in Coimbatore. Anything that arrives damaged or faulty is replaced or refunded in full.',
  },
  {
    question: 'Do you ship outside India?',
    answer: 'Not yet. We are working on it — join the newsletter and we will tell you when we do.',
  },
  {
    question: 'How do I know if something is back in stock?',
    answer:
      'Out-of-stock items stay visible with an “Out of stock” badge. Save one to your wishlist and check back — restocks usually happen within two to three weeks.',
  },
];
