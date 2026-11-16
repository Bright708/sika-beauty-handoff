// Opens Paystack's popup for a transaction our server already initialized.
// Loaded only when the shopper presses Pay. No card details ever touch our page.
// Resolves with 'success' | 'cancel'; rejects if the popup could not load.
export async function payWithPaystack(accessCode) {
  const { default: PaystackPop } = await import('@paystack/inline-js')
  return new Promise((resolve, reject) => {
    new PaystackPop().resumeTransaction(accessCode, {
      onSuccess: () => resolve('success'),
      onCancel: () => resolve('cancel'),
      onError: (err) => reject(new Error(err?.message || 'The payment window could not open.')),
    })
  })
}
