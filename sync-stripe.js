/**
 * Triggers the Stripe sync admin job endpoint.
 *
 * @returns {Promise<void>} - A promise that resolves once the synchronization is complete.
 */
const sync = async () => {
  try {
    console.log('Starting sync with Stripe admin job');
    const baseUrl = process.env.APP_URL;
    if (!baseUrl) {
      throw new Error('APP_URL environment variable not set');
    }

    const syncSecret = process.env.STRIPE_SYNC_SECRET;
    const response = await fetch(`${baseUrl}/api/admin/stripe/sync`, {
      method: 'POST',
      headers: syncSecret
        ? {
            'x-stripe-sync-secret': syncSecret,
          }
        : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Stripe sync failed: ${response.status} ${response.statusText} ${body}`
      );
    }

    const payload = await response.json();
    console.log('Sync completed successfully', payload);
    process.exit(0);
  } catch (error) {
    console.error('Error syncing with Stripe:', error);
    process.exit(1);
  }
};

sync();

// handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
