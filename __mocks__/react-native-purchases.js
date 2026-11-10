// Automatischer Mock fuer das native RevenueCat-SDK (Jest nutzt __mocks__ neben node_modules).
const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1',
  PURCHASE_NOT_ALLOWED_ERROR: '3',
  PRODUCT_ALREADY_PURCHASED_ERROR: '6',
  NETWORK_ERROR: '10',
  PAYMENT_PENDING_ERROR: '20',
};
const PRORATION_MODE = { IMMEDIATE_WITH_TIME_PRORATION: 1 };
const emptyInfo = { entitlements: { active: {}, all: {} } };
const Purchases = {
  configure: jest.fn(),
  logIn: jest.fn(async () => ({ customerInfo: emptyInfo, created: false })),
  logOut: jest.fn(async () => emptyInfo),
  getOfferings: jest.fn(async () => ({ current: null, all: {} })),
  getCustomerInfo: jest.fn(async () => emptyInfo),
  purchasePackage: jest.fn(async () => ({ customerInfo: emptyInfo, productIdentifier: '' })),
  restorePurchases: jest.fn(async () => emptyInfo),
};
module.exports = { __esModule: true, default: Purchases, PURCHASES_ERROR_CODE, PRORATION_MODE };
