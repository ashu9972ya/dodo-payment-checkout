export type PaymentResult =
  | {
      status: "success";
      sessionId: string;
    }
  | {
      status: "declined";
      code: "CARD_DECLINED";
      message: string;
    }
  | {
      status: "failed";
      code: "PAYMENT_FAILED";
      message: string;
    };

const attempts = new Map<string, number>();

export async function processPayment(
  cardNumber: string
): Promise<PaymentResult> {
  await delay(1200);

  const normalizedCard = cardNumber.replace(/\s/g, "");

  // Successful card
  if (normalizedCard === "4242424242424242") {
    return {
      status: "success",
      sessionId: `sess_${crypto.randomUUID()}`,
    };
  }

  // Declined card
  if (normalizedCard === "4000000000000002") {
    return {
      status: "declined",
      code: "CARD_DECLINED",
      message: "Your bank declined this payment.",
    };
  }

  // Fails once, succeeds on retry
  if (normalizedCard === "4000000000000341") {
    const attempt = attempts.get(normalizedCard) ?? 0;

    attempts.set(normalizedCard, attempt + 1);

    if (attempt === 0) {
      return {
        status: "failed",
        code: "PAYMENT_FAILED",
        message:
          "Something went wrong while processing your payment.",
      };
    }

    return {
      status: "success",
      sessionId: `sess_${crypto.randomUUID()}`,
    };
  }

  // Unknown card
  return {
    status: "declined",
    code: "CARD_DECLINED",
    message: "This test card is not supported.",
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}