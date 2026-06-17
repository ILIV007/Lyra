const TOKEN = process.env.TELEGRAM_TOKEN;
const WEBHOOK_URL = 'https://lyra.iliv007.workers.dev/webhook';

if (!TOKEN) {
  console.error('TELEGRAM_TOKEN environment variable is required');
  process.exit(1);
}

async function setWebhook() {
  const url = `https://api.telegram.org/bot${TOKEN}/setWebhook`;
  const body = JSON.stringify({
    url: WEBHOOK_URL,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    const data = await response.json();
    if (data.ok) {
      console.log('✅ Webhook set successfully');
      console.log(`URL: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Failed to set webhook');
      console.error(data);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error setting webhook:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setWebhook();
}

module.exports = { setWebhook };