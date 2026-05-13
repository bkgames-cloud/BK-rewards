/** Compat : logique déplacée dans `services/payment.service.ts`. */
export {
  PaymentService,
  buyVIP,
  buyVIPPlus,
  filterSubscriptionBannerMessage,
  initPaymentClientBridge,
  isAndroidEmbeddedPaymentShell,
} from "@/services/payment.service"
export type { SubscribePlan, AndroidPriceLabels, VipBillingPeriod } from "@/services/payment.service"
