import { Button } from 'react-daisyui';
import getSymbolFromCurrency from 'currency-symbol-map';

import { Price, Prisma, Service } from '@prisma/client';

interface PaymentButtonProps {
  plan: Service;
  price: Price;
  onPlanChange: (priceId: string, quantity?: number) => void;
}

const PaymentButton = ({ plan, price, onPlanChange }: PaymentButtonProps) => {
  const metadata = price.metadata as Prisma.JsonObject;
  const recurring = metadata?.recurring as Prisma.JsonObject | undefined;
  const usageType =
    (recurring?.usage_type as string | undefined) ??
    (metadata?.usage_type as string | undefined);
  const currencySymbol = getSymbolFromCurrency(price.currency || 'USD');
  let buttonText = 'Get Started';

  if (metadata?.interval === 'month') {
    buttonText = price.amount
      ? `${currencySymbol}${price.amount} / month`
      : `Monthly`;
  } else if (metadata?.interval === 'year') {
    buttonText = price.amount
      ? `${currencySymbol}${price.amount} / year`
      : `Yearly`;
  }

  return (
    <Button
      key={`${plan.id}-${price.id}`}
      color="primary"
      variant="outline"
      size="md"
      fullWidth
      onClick={() => {
        onPlanChange(
          price.id,
          (price.billingScheme == 'per_unit' ||
            price.billingScheme == 'tiered') &&
            usageType !== 'metered'
            ? 1
            : undefined
        );
      }}
      className="rounded-full"
    >
      {buttonText}
    </Button>
  );
};

export default PaymentButton;
