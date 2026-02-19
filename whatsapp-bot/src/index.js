const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN; // توكن واتساب من Meta
const PHONE_ID = process.env.PHONE_NUMBER_ID; // رقم الهاتف من Meta
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_verify_token";

// ===== بيانات المنتجات - عدّلها حسب متجرك =====
const PRODUCTS = {
  electronics: [
    {
      id: "prod_1",
      name: "سماعات بلوتوث",
      price: "150 ر.س",
      desc: "جودة صوت عالية، بطارية 20 ساعة",
    },
    {
      id: "prod_2",
      name: "ساعة ذكية",
      price: "300 ر.س",
      desc: "شاشة AMOLED، مقاومة للماء",
    },
  ],
  accessories: [
    {
      id: "prod_3",
      name: "كفر هاتف",
      price: "50 ر.س",
      desc: "متوفر لجميع الموديلات",
    },
    {
      id: "prod_4",
      name: "شاحن لاسلكي",
      price: "80 ر.س",
      desc: "شحن سريع 15W",
    },
  ],
};

// ===== إرسال رسالة =====
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    body,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );
}

// ===== رسالة نصية بسيطة =====
async function sendText(to, text) {
  await sendMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// ===== رسائل بأزرار =====
async function sendButtons(to, bodyText, buttons) {
  await sendMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

// ===== رسالة قائمة =====
async function sendList(to, bodyText, buttonLabel, sections) {
  await sendMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: { button: buttonLabel, sections },
    },
  });
}

// ===== القائمة الرئيسية =====
async function sendMainMenu(to) {
  await sendButtons(to, `👋 أهلاً بك في متجرنا!\n\nكيف يمكننا مساعدتك؟`, [
    { id: "menu_products", title: "🛍️ تصفح المنتجات" },
    { id: "menu_faq", title: "❓ الأسئلة الشائعة" },
    { id: "menu_agent", title: "👨‍💼 تواصل مع موظف" },
  ]);
}

// ===== عرض المنتجات =====
async function sendProductCategories(to) {
  await sendButtons(to, "🛍️ اختر فئة المنتجات:", [
    { id: "cat_electronics", title: "📱 إلكترونيات" },
    { id: "cat_accessories", title: "🎧 إكسسوارات" },
  ]);
}

async function sendProductList(to, category) {
  const items = PRODUCTS[category] || [];
  const rows = items.map((p) => ({
    id: p.id,
    title: p.name,
    description: `${p.price} | ${p.desc}`,
  }));
  await sendList(to, "✨ اختر منتجاً لمعرفة التفاصيل:", "عرض المنتجات", [
    { title: "المنتجات المتاحة", rows },
  ]);
}

// ===== تفاصيل منتج =====
function findProduct(id) {
  for (const cat of Object.values(PRODUCTS)) {
    const p = cat.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}

async function sendProductDetail(to, productId) {
  const p = findProduct(productId);
  if (!p) return sendText(to, "عذراً، لم يتم العثور على المنتج.");
  await sendButtons(to, `*${p.name}*\n💰 السعر: ${p.price}\n📝 ${p.desc}`, [
    { id: `order_${productId}`, title: "🛒 طلب الآن" },
    { id: "menu_products", title: "🔙 رجوع" },
  ]);
}

// ===== الأسئلة الشائعة =====
async function sendFAQ(to) {
  await sendList(to, "❓ الأسئلة الشائعة - اختر سؤالاً:", "عرض الأسئلة", [
    {
      title: "الشحن والتوصيل",
      rows: [
        { id: "faq_shipping", title: "🚚 مواعيد التوصيل" },
        { id: "faq_cost", title: "💵 تكلفة الشحن" },
      ],
    },
    {
      title: "الطلبات",
      rows: [
        { id: "faq_return", title: "🔄 سياسة الإرجاع" },
        { id: "faq_payment", title: "💳 طرق الدفع" },
      ],
    },
  ]);
}

const FAQ_ANSWERS = {
  faq_shipping:
    "🚚 *مواعيد التوصيل*\nيتم التوصيل خلال 2-5 أيام عمل داخل المملكة.",
  faq_cost:
    "💵 *تكلفة الشحن*\nالشحن مجاني للطلبات فوق 200 ر.س، وبتكلفة 25 ر.س للطلبات الأقل.",
  faq_return:
    "🔄 *سياسة الإرجاع*\nيمكن إرجاع المنتجات خلال 14 يوماً من الاستلام بشرط أن تكون بحالتها الأصلية.",
  faq_payment:
    "💳 *طرق الدفع*\nنقبل: مدى، فيزا، ماستركارد، تحويل بنكي، والدفع عند الاستلام.",
};

// ===== معالجة الرسائل الواردة =====
async function handleMessage(message) {
  const from = message.from;
  let id = null;

  if (message.type === "interactive") {
    id =
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id;
  } else if (message.type === "text") {
    const text = message.text.body.trim().toLowerCase();
    if (["مرحبا", "هلا", "hi", "hello", "start", "ابدأ"].includes(text)) {
      return sendMainMenu(from);
    }
    return sendMainMenu(from);
  }

  if (!id) return;

  // ===== منطق التوجيه حسب الزر المضغوط =====
  if (id === "menu_products") return sendProductCategories(from);
  if (id === "cat_electronics") return sendProductList(from, "electronics");
  if (id === "cat_accessories") return sendProductList(from, "accessories");
  if (id.startsWith("prod_")) return sendProductDetail(from, id);
  if (id === "menu_faq") return sendFAQ(from);
  if (id in FAQ_ANSWERS) {
    await sendText(from, FAQ_ANSWERS[id]);
    return sendButtons(from, "هل تحتاج مساعدة أخرى؟", [
      { id: "menu_faq", title: "❓ سؤال آخر" },
      { id: "menu_products", title: "🛍️ تصفح المنتجات" },
    ]);
  }
  if (id.startsWith("order_")) {
    const productId = id.replace("order_", "");
    const p = findProduct(productId);
    await sendText(
      from,
      `✅ تم استلام طلبك على: *${p?.name}*\n\nسيتواصل معك فريقنا قريباً لتأكيد الطلب وتفاصيل الدفع. 📦`,
    );
    // هنا يمكنك إضافة كود لحفظ الطلب في قاعدة البيانات
    return sendButtons(from, "هل تريد شيئاً آخر؟", [
      { id: "menu_products", title: "🛍️ تسوق أكثر" },
      { id: "menu_agent", title: "👨‍💼 تحدث مع موظف" },
    ]);
  }
  if (id === "menu_agent") {
    return sendText(
      from,
      "👨‍💼 سيتواصل معك أحد موظفينا في أقرب وقت ممكن.\n\nأوقات العمل: السبت - الخميس، 9 صباحاً - 9 مساءً 🕘",
    );
  }
}

// ===== Webhook التحقق =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===== Webhook استقبال الرسائل =====
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // رد فوري لـ Meta
  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if (messages && messages.length > 0) {
      await handleMessage(messages[0]);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
});

app.get("/", (req, res) => res.send("WhatsApp Bot is running! 🤖"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));
