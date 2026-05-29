# MagnetiX v3 — Kullanım Kılavuzu

**Sürüm:** 3.0 · **Son güncelleme:** Mayıs 2026

---

## Genel Bakış

MagnetiX v3, **Delphi yöntemi**ni dijital ortama taşıyan bir ihtiyaç belirleme platformudur. Uzmanların görüşleri sistematik biçimde toplanır; altmoderatörler tarafından bağımsız olarak kodlanır; moderatör tarafından consensus analizine tabi tutularak nihai bir ihtiyaç listesi oluşturulur.

Platform üç ayrı web uygulamasından oluşur:

| Uygulama | Rol |
|---|---|
| **Expert** | Uzman not girişi |
| **SubModerator** | AltModeratör kodlaması ve revizyonu |
| **Moderator** | Oturum yönetimi, kodlama, consensus analizi, rapor |

Tüm veriler **Firebase Firestore**'da saklanır; uygulamalar arasında ortak veri tabanı üzerinden paylaşım sağlanır.

---

## Süreç Özeti

```
T1 — Uzman Notları
  │
  ▼
T2 — Moderatör Kodlaması  →  T2 — AltModeratör Revizyonu (bağımsız, n kez)
  │                                         │
  └─────────────────────────────────────────┘
                           │
                           ▼
               T3 — Consensus Analizi & Nihai Rapor
```

| Aşama | Aktör | Çıktı |
|---|---|---|
| **T1** | Uzmanlar | Serbest metin notlar (`l1_notes_v3`) |
| **T2 — Kodlama** | Moderatör | Gruplandırılmış madde listesi (`moderator_t2_v3`) |
| **T2 — Revizyon** | Her altmoderatör (bağımsız) | Revize edilmiş gruplar (`t2_codings_v3`) |
| **T3** | Moderatör | Consensus skorlu nihai liste (`t3_final_v3`) |

---

## Adım Adım Kullanım

### 1. Oturum Oluşturma (Moderatör)

1. Moderatör uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. **Oturumlar** ekranında oturum adını yazın → **Oluştur**.
4. Oluşturulan oturum Firestore'a kaydedilir; Expert ve SubModerator uygulamaları bu oturumu otomatik listeler.

> Oturum durumları sırasıyla: `l1` → `coding` → `moderating` → `done`

---

### 2. Uzman Not Girişi (Expert)

1. Expert uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. Listeden oturumu seçin.
4. Görüşlerinizi serbest metin olarak yazın. Her satır veya madde işaretiyle (`-`) ayrılmış liste kullanılabilir.
5. **Taslak Kaydet** — notu sayfayı kapatmadan önce saklar (Firestore + localStorage).
6. **Gönder** — not Firestore'a yazılır, oturum kilitlenir.

> Birden fazla uzman aynı oturuma not girebilir. Her uzmanın en son gönderdiği not geçerlidir.

---

### 3. T2 Kodlaması Oluşturma (Moderatör)

Uzman notları girildikten sonra moderatör bu notları kodlar.

#### 3a. Online Kodlama

1. Oturumu seçin → **Yönet** ekranı açılır.
2. **Online Kodla** butonuna tıklayın.
3. Sistem, notları satırlara ayırır ve kural tabanlı sınıflandırmayla otomatik gruplara atar.
4. Kodlama board'u açılır.

#### 3b. YZ ile Kodlama

1. **Online Kodla** ile board'a geçin.
2. Sağ üstteki **model seçici** dropdown'dan YZ modelini seçin (DeepSeek veya Gemini).
3. **YZ ile Kodla** butonuna tıklayın.
4. YZ, uzman notlarını analiz ederek gruplar ve maddeler önerir. Sonuç board'a yüklenir; elle düzenlenebilir.

#### 3c. CSV ile Kodlama (Çalıştay Verisi)

Dışarıdan hazırlanmış bir CSV dosyası varsa (örn. atölye çalışması çıktısı):

1. Board ekranında **CSV Yükle** butonuna tıklayın.
2. CSV formatı: `grup_adi`, `madde_metni`, `uzman_adi`, `kategori` sütunları — başlık satırı zorunlu.
3. Dosya yüklenince gruplar ve maddeler board'a aktarılır.

#### Kodlama Board'u — İşlemler

| İşlem | Nasıl yapılır |
|---|---|
| Madde taşıma | Sürükle-bırak |
| Grup yeniden adlandırma | Grup başlığındaki kalem ikonu |
| Grup silme | Çöp kutusu ikonu |
| Yeni grup ekleme | **Yeni Grup** butonu → ad girin → Enter |
| Madde ekleme | Grup içinde **+ Madde ekle** → metin → Enter |
| Madde silme | Madde yanındaki × |

#### Kaydet & Yayınla

- T2 kodlaması Firestore'a yazılır (`moderator_t2_v3/{sessionId}`).
- AltModeratörler bu veriyi SubModerator uygulamasından otomatik çeker.
- **JSON Export** butonu ile offline yedek alınabilir.

---

### 4. AltModeratör Revizyonu (SubModerator)

1. SubModerator uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. Listeden oturumu seçin.
4. Moderatörün T2 kodlaması otomatik yüklenir.

Her altmoderatör, moderatörün gruplamalarını **bağımsız olarak** ve **birbirinden habersiz** değerlendirir. Board üzerinde aynı işlemler (sürükle-bırak, yeniden adlandırma, madde ekleme/silme) uygulanabilir.

**Kaydet & Gönder** → Revizyon Firestore'a yazılır (`t2_codings_v3/{sessionId}_{subModName}`). JSON otomatik indirilir (yedek).

> Kaç altmoderatör varsa o kadar bağımsız T2 kaydı oluşur. Bu kayıtlar consensus hesaplamasının temelini oluşturur.

---

### 5. Consensus Analizi ve T3 Raporu (Moderatör)

Tüm altmoderatörler revizyonlarını gönderdikten sonra:

1. Moderatör uygulamasında oturumu seçin → **Yönet**.
2. **T2 — AltModeratör Revizyonları** bölümünde revizyonlar listelenir.
3. **Consensus Görünümü →** butonuna tıklayın.

#### Consensus & T3 Düzenleme Ekranı

Ekranda iki sekme bulunur:

**Consensus Sekmesi** (referans)
- Her grup için altmoderatör bazında ✓/✗ matris görünümü
- Grup ve madde consensus yüzde skorları, renk kodlu
- Minimum eşik filtresi (düşük consensus'lu grupları gizler)

**T3 Düzenle Sekmesi** (nihai gruplama)

Moderatör, consensus verilerini gördükten sonra nihai T3 listesini oluşturur. Tüm board işlemleri (sürükle-bırak, adlandırma, madde ekleme/silme) bu sekmede de geçerlidir.

**Tartışma Notları:** Toplantı kararları ve gerekçeler buraya yazılır; T3 ile birlikte kaydedilir.

#### Kaydet & Tamamla

- T3 Firestore'a yazılır (`t3_final_v3/{sessionId}`).
- Oturum durumu `done` olarak güncellenir.
- T3 Raporu ekranı otomatik açılır.

---

### 6. T3 Raporu

Kaydet & Tamamla'dan sonra veya **T3 Raporu Görüntüle** butonuyla erişilir.

| Bölüm | İçerik |
|---|---|
| Özet Kartlar | Toplam grup sayısı, toplam madde sayısı, ≥%50 consensus grup sayısı |
| Consensus Bar Chart | Her grubun yüzde skoru — yatay çubuk grafik |
| Top 10 Madde | En yüksek consensus skorlu maddeler |
| Grup Kartları | Renk kodlu, açılır/kapanır — maddeler ve bireysel skorlar |
| Tartışma Notları | Moderatörün kaydettiği notlar |

**JSON İndir** butonu ile tüm T3 verisi makine okunabilir formatta indirilebilir.

---

## Çalıştay Modu

Çalıştay modu, bir atölye çalışması veya yüz yüze toplantı çıktısının sisteme ayrı bir veri olarak işlenmesini sağlar. Bu mod etkinleştirildiğinde T3 kaydı standart koleksiyon (`t3_final_v3`) yerine **`t3_workshop_v3`** koleksiyonuna yazılır; böylece yürütülen oturumun ana verisi korunur.

### Modu Etkinleştirme

1. Moderatör uygulamasında **Oturumlar** ekranında veya bir oturumun **Yönet** ekranında sağ üstteki **🏕️ Çalıştay** toggle'ına tıklayın.
2. Toggle açık hale gelince amber (kehribar) renk alır.
3. `code` ve `review` ekranlarında bir banner göstererek hangi koleksiyona yazılacağını hatırlatır.

### Çalıştay Akışı

1. Çalıştay Modu toggle'ını **açın**.
2. CSV dosyasını **CSV Yükle** ile board'a yükleyin.
3. Gerekirse DnD ile düzenleyin.
4. **YZ Sadeleştir** butonu ile benzer/tekrarlayan maddeler YZ tarafından birleştirilir (aşağıya bakın).
5. **Kaydet & Tamamla** → veri `t3_workshop_v3` koleksiyonuna yazılır.

### YZ Sadeleştir (Çalıştay Modu)

Review ekranında, Çalıştay Modu açıkken **YZ Sadeleştir** butonu görünür:

1. Model dropdown'dan YZ modelini seçin.
2. **YZ Sadeleştir** butonuna tıklayın.
3. YZ, her grupta çok benzer veya aynı anlama gelen maddeleri tek maddeye indirger. Birleştirilen maddenin uzman listesi tüm kaynaklardan oluşur.
4. Sonuç T3 Düzenle sekmesine yüklenir; elle daha fazla düzenlenebilir.
5. Hazır olunca **Kaydet & Tamamla**.

> Çalıştay Modu kapatılarak standart akışa her zaman geri dönülebilir. İki koleksiyondaki veriler birbirini etkilemez.

---

## Consensus Skoru Hesaplama

### Grup Consensus Skoru

```
grupConsensus = (grubu içeren altmod sayısı) / (toplam altmod sayısı)
```

*Örnek:* 4 altmoderatörden 3'ü "Eğitim" grubunu kodladıysa → 3/4 = **%75**

### Madde Consensus Skoru

```
maddeConsensus = (maddeyi kodlayan altmod sayısı) / (toplam altmod sayısı)
```

Madde metni büyük/küçük harf ve boşluk normalize edilerek eşleştirilir.

### Renk Kodları

| Renk | Aralık | Anlam |
|---|---|---|
| Yeşil | ≥ %80 | Güçlü consensus |
| Sarı-yeşil | %60–79 | Orta-güçlü consensus |
| Sarı | %40–59 | Zayıf consensus |
| Kırmızı | < %40 | Consensus yok |

---

## Offline / Hibrit Kullanım

İnternet bağlantısı sınırlı ortamlar için:

1. **Moderatör → JSON Export**: T2 kodlaması JSON olarak indirilir, altmoderatörlere e-posta veya USB ile iletilir.
2. **AltModeratör**: JSON dosyasını SubModerator uygulamasına yükler, revizyonunu yapar, JSON olarak kaydeder.
3. **Moderatör → T2 JSON İmport**: Gelen JSON dosyaları toplu olarak yüklenir (çoklu dosya seçimi desteklenir).

CSV akışı da offline çalışmayı destekler: moderatör T2'yi CSV olarak indirir, dışarıda düzenler, tekrar yükler.

---

## Firestore Koleksiyonları

| Koleksiyon | Açıklama | Belge ID |
|---|---|---|
| `sessions_v3` | Oturum meta verisi | `session_{timestamp}` |
| `l1_notes_v3` | Uzman ham notları | `{sessionId}_{expertName}` |
| `moderator_t2_v3` | Moderatörün T2 kodlaması | `{sessionId}` |
| `t2_codings_v3` | AltModeratör revizyonları | `{sessionId}_{subModName}` |
| `t3_final_v3` | Nihai T3 consensus sonucu | `{sessionId}` |
| `t3_workshop_v3` | Çalıştay modu T3 sonucu | `{sessionId}` |

---

## Teknik Altyapı

- **Firebase projesi:** `magnetix-ihtiyac-panosu`
- **Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + @dnd-kit + Firebase
- **YZ entegrasyonu:** OpenRouter API — DeepSeek V4 Flash veya Gemini 3.1 Flash Lite (model seçimi moderatör ekranında)
- **Deploy:** Her uygulama bağımsız Vercel projesi
- **Güvenlik notu:** Firestore kuralları `allow read, write: if true` — üretim ortamında kimlik doğrulama tabanlı kurallarla güncellenmesi önerilir
