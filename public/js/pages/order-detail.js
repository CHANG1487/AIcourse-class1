const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      pending: { text: '付款尚未確認，請依指示完成匯款或超商繳費，完成後重新整理本頁。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    // Redirect browser to ECPay payment page via dynamically built form
    async function handleEcpayCheckout() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + order.value.id + '/ecpay/create', { method: 'POST' });
        const { formUrl, params } = res.data;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = formUrl;
        for (const [key, value] of Object.entries(params)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        const msg = (e && e.data && e.data.message) ? e.data.message : '建立付款連結失敗，請稍後再試';
        Notification.show(msg, 'error');
        paying.value = false;
      }
    }

    // Called after ECPay redirects back via ClientBackURL (?payment_check=1)
    async function verifyPayment() {
      try {
        const res = await apiFetch('/api/orders/' + orderId + '/ecpay/verify', { method: 'POST' });
        const { status } = res.data;
        if (order.value) order.value.status = status;
        paymentResult.value = status === 'paid' ? 'success' : status === 'failed' ? 'failed' : 'pending';
      } catch (e) {
        Notification.show('查詢付款結果失敗，請重新整理頁面', 'error');
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;

        // Auto-verify after ECPay ClientBackURL redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment_check') === '1') {
          await verifyPayment();
          // Clean up query string without reloading
          history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return { order, loading, paying, paymentResult, statusMap, paymentMessages, handleEcpayCheckout };
  }
}).mount('#app');
