// ============================================================
// Stripe Webhook受信API（署名検証付き）
//
// 【Webhookとは？】
// 「決済が完了した」等のイベントを、Stripe側からうちのサーバーに
// 通知してくれる仕組み。Cloud Functionsのトリガーと同じ
// 「イベントが起きたら呼ばれる」タイプのAPI。
//
// 【なぜ署名検証が必須か？】
// このURLは外部に公開されるため、悪意のある人が
// 「決済完了したよ」という偽の通知を送りつけることができてしまう。
// Stripeは通知に「署名」を付けてくるので、
// シークレットを使って「本当にStripeからの通知か」を検証する。
// 検証せずに信じると、支払っていない人を有料会員にされてしまう。
// ============================================================

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // 署名検証には「加工前の生のリクエストボディ」が必要
  // （readBodyでJSONにパースすると署名が一致しなくなる）
  const rawBody = await readRawBody(event)
  const signature = getHeader(event, 'stripe-signature')

  if (!rawBody || !signature) {
    throw createError({ statusCode: 400, statusMessage: '不正なリクエストです' })
  }

  let stripeEvent
  try {
    // ここが署名検証の本体
    // 偽物・改ざんされた通知はここで例外になる
    stripeEvent = stripe().webhooks.constructEvent(
      rawBody,
      signature,
      config.stripeWebhookSecret,
    )
  } catch {
    throw createError({ statusCode: 400, statusMessage: '署名検証に失敗しました' })
  }

  // 検証を通過した本物のイベントだけがここに到達する
  switch (stripeEvent.type) {
    // 決済（サブスク契約）が完了した
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object
      const uid = session.client_reference_id

      if (uid) {
        // Firestoreに契約状態を保存
        await adminFirestore()
          .collection('users').doc(uid)
          .collection('billing').doc('subscription')
          .set({
            status: 'active',
            plan: session.metadata?.plan ?? 'unknown',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          })
      }
      break
    }

    // サブスクが解約された
    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object
      // 該当ユーザーを検索して契約状態を更新
      const snap = await adminFirestore()
        .collectionGroup('billing')
        .where('stripeSubscriptionId', '==', subscription.id)
        .get()

      for (const doc of snap.docs) {
        await doc.ref.set(
          { status: 'canceled', updatedAt: new Date().toISOString() },
          { merge: true },
        )
      }
      break
    }
  }

  // Stripeに「受け取ったよ」と返す（返さないとStripeが再送し続ける）
  return { received: true }
})
