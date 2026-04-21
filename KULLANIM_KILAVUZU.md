# MagnetiX v3 — Kullanım Kılavuzu

## Genel Bakış

MagnetiX v3, **Delphi yöntemi**ni dijital ortama taşıyan bir ihtiyaç belirleme platformudur. Uzmanların görüşleri sistematik olarak toplanır, altmoderatörler tarafından kodlanır ve moderatör tarafından consensus analizine tabi tutularak nihai bir ihtiyaç listesi ortaya çıkarılır.

Sistem üç ayrı web uygulamasından oluşur:

| Uygulama | Rol | Adres |
|---|---|---|
| **Expert** | Uzman not girişi | `expert/` |
| **SubModerator** | AltModeratör kodlama | `submoderator/` |
| **Moderator** | Oturum yönetimi, kodlama, consensus, rapor | `moderator/` |

Tüm veriler **Firebase Firestore**'da saklanır ve uygulamalar arasında gerçek zamanlı paylaşılır.

---

## Süreç Akışı

```
T1                    T2                       T3
──────────────────────────────────────────────────────────────
Uzmanlar         AltModeratörler           Moderatör
L1 not yazar  →  moderatör T2'yi alır  →  consensus hesaplar
                 revize eder               T3 düzenler
                 gönderir                  raporu kaydeder
```

### Aşama Özeti

1. **T1 — Uzman Notları**: Her uzman kendi görüşlerini serbest metin olarak yazar.
2. **T2 — Moderatör Kodlaması**: Moderatör uzman notlarını maddelere ayırır, gruplar oluşturur ve altmoderatörlere yayınlar.
3. **T2 — AltModeratör Revizyonu**: Her altmoderatör moderatörün gruplarını bağımsız olarak inceler, yeniden düzenler, madde ekler/siler.
4. **T3 — Consensus Analizi**: Moderatör tüm altmoderatör revizyonlarını bir araya getirir, consensus skorlarını görür, nihai gruplamayı yapar ve T3 raporunu kaydeder.

---

## Adım Adım Kullanım

### 1. Moderatör — Oturum Oluşturma

1. Moderatör uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. **Oturumlar** ekranında oturum adını yazın → **Oluştur**.
4. Oluşturulan oturum Firestore'a kaydedilir; tüm uygulamalar bu oturumu görür.

> **Oturum durumları:** `l1` → `coding` → `moderating` → `done`

---

### 2. Expert — Uzman Not Girişi

1. Expert uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. Açılan listeden oturumu seçin.
4. Görüşlerinizi serbest metin olarak yazın (her satır veya madde işaretiyle ayrılmış liste olabilir).
5. **Kaydet** → not Firestore'a yazılır (`l1_notes_v3/{sessionId}_{expertName}`).

> Birden fazla uzman aynı oturuma not girebilir. Her uzmanın son kaydı geçerlidir.

---

### 3. Moderatör — T2 Kodlaması Oluşturma

Uzman notları girildikten sonra moderatör bu notları kodlar.

#### Online Kodlama (önerilen)

1. Moderatör uygulamasında oturumu seçin → **Yönet** ekranı açılır.
2. **T1 — Uzman Notları** bölümünde notlar listelenir.
3. **Online Kodla** butonuna tıklayın.
4. Sistem, notları satırlara ayırır ve kural tabanlı sınıflandırmayla otomatik gruplara atar.

#### Offline Kodlama

1. **Offline JSON Yükle** ile dışarıdan hazırlanmış bir `L1Note[]` JSON dosyası yüklenebilir.

#### Kodlama Board'u

- **Sürükle-bırak**: Maddeleri gruplar arasında taşıyın.
- **Grup yeniden adlandırma**: Grup başlığındaki kalem ikonuna tıklayın.
- **Grup silme**: Çöp kutusu ikonu.
- **Yeni grup**: Sağ üstteki **Yeni Grup** butonu → ad girin → Enter.
- **Madde ekleme**: Grup içindeki **+ Madde ekle** linkine tıklayın → metin girin → Enter.
- **Madde silme**: Madde yanındaki **×** butonu.

#### Kaydet & Yayınla

- **Kaydet & Yayınla**: T2 kodlaması Firestore'a yazılır (`moderator_t2_v3/{sessionId}`). AltModeratörler bu veriyi otomatik çeker.
- **Offline Export**: JSON olarak indirilir (internet olmayan ortam için).

---

### 4. AltModeratör — Revizyon

1. SubModerator uygulamasını açın.
2. Adınızı girin → **Giriş Yap**.
3. Listeden oturumu seçin.
4. Moderatörün T2 kodlaması otomatik yüklenir (moderatör henüz yayınlamadıysa mock veri gelir).

#### Revizyon Board'u

AltModeratör, moderatörün gruplarını **bağımsız olarak** değerlendirir:

- **Sürükle-bırak**: Maddeleri gruplar arasında taşıyın.
- **Grup yeniden adlandırma**: Kalem ikonu.
- **Grup silme**: Çöp kutusu.
- **Yeni grup**: Sağ üstteki **Yeni Grup** butonu.
- **Madde ekleme**: Grup içinde **+ Madde ekle** → metin girin → Enter. (Eklenen madde altmoderatör adıyla etiketlenir.)
- **Madde silme**: Madde yanındaki **×**.

#### Kaydet & Gönder

- Firestore'a yazılır (`t2_codings_v3/{sessionId}_{subModName}`).
- JSON olarak otomatik indirilir (yedek için).

> Her altmoderatör kendi revizyonunu bağımsız yapar. Kaç altmoderatör varsa o kadar T2 kaydı oluşur.

---

### 5. Moderatör — Consensus Analizi ve T3

Tüm altmoderatörler revizyonlarını gönderdikten sonra:

1. Moderatör uygulamasında oturumu seçin → **Yönet**.
2. **T2 — AltModeratör Revizyonları** bölümünde:
   - **Firestore'dan otomatik yükle**: Sayfayı açınca mevcut revizyonlar gelir.
   - **T2 JSON İmport**: Offline gönderilen JSON dosyalarını yükleyin (çoklu seçim).
3. **Consensus Görünümü →** butonuna tıklayın.

#### Consensus & T3 Düzenleme Ekranı

Ekranın üstünde iki sekme vardır:

##### Consensus Sekmesi (referans)

- **Matris görünümü**: Her grup için hangi altmoderatörün ✓ koyduğunu gösterir. Yüzde skoru renk kodludur (yeşil ≥%80, sarı %40-60, kırmızı <%40).
- **Liste görünümü**: Her grubu açınca maddeler ve bireysel consensus skorları görünür.
- **Min % filtresi**: Düşük consensus'lu grupları gizlemek için.

##### T3 Düzenle Sekmesi (nihai gruplama)

Moderatör consensus verilerini gördükten sonra nihai T3'ü oluşturur:

- **Sürükle-bırak**: Maddeler gruplar arasında taşınabilir.
- **Grup yeniden adlandırma / silme**: Kalem ve çöp kutusu ikonu.
- **Yeni grup**: **Yeni Grup Ekle** butonu.
- **Madde ekleme**: Grup içinde **+ Madde ekle** → Enter. (Moderatör adı ve `consensusScore: 0` ile eklenir.)
- **Madde silme**: Madde yanındaki **×**.
- Her grup başlığında **consensus %** skoru referans olarak görünür.

#### Tartışma Notları

Her iki sekmenin altında tartışma notları alanı bulunur. Toplantı kararları, gerekçeler buraya yazılır ve T3 ile birlikte kaydedilir.

#### Kaydet & Tamamla

- T3 Firestore'a yazılır (`t3_final_v3/{sessionId}`).
- Oturum durumu `done` olarak güncellenir.
- **T3 Raporu** otomatik açılır.

---

### 6. T3 Raporu

Kaydet & Tamamla'dan sonra veya daha önce kaydedilmiş bir oturum için **T3 Raporu Görüntüle** butonuyla erişilir.

Rapor şunları içerir:

| Bölüm | İçerik |
|---|---|
| **Özet Kartlar** | Toplam grup sayısı, toplam madde sayısı, ≥%50 consensus grup sayısı |
| **Grup Consensus Bar Chart** | Her grubun consensus yüzdesi animasyonlu yatay bar grafik |
| **Top 10 Madde** | En yüksek consensus skorlu maddeler sıralı liste |
| **Grup Kartları** | Tüm gruplar renk kodlu, açılır/kapanır — içinde maddeler ve bireysel konsensus skorları |
| **Tartışma Notları** | Moderatörün kaydettiği notlar |

**JSON İndir** butonu ile tüm T3 verisi makine okunabilir formatta indirilebilir.

---

## Firestore Koleksiyonları

| Koleksiyon | Açıklama | Belge ID |
|---|---|---|
| `sessions_v3` | Oturum meta verisi | `session_{timestamp}` |
| `l1_notes_v3` | Uzman ham notları | `{sessionId}_{expertName}` |
| `moderator_t2_v3` | Moderatörün T2 kodlaması | `{sessionId}` |
| `t2_codings_v3` | AltModeratör revizyonları | `{sessionId}_{subModName}` |
| `t3_final_v3` | Nihai T3 consensus sonucu | `{sessionId}` |

---

## Consensus Skoru Hesaplama

### Grup Consensus Skoru

```
grupConsensus = (grubu içeren altmod sayısı) / (toplam altmod sayısı)
```

Örnek: 4 altmoderatörden 3'ü "Eğitim" grubunu kodladıysa → `3/4 = %75`

### Madde Consensus Skoru

```
maddeConsensus = (maddeyi kodlayan altmod sayısı) / (toplam altmod sayısı)
```

Madde metni büyük/küçük harf ve boşluk normalize edilerek eşleştirilir.

### Renk Kodları

| Renk | Aralık | Anlam |
|---|---|---|
| 🟢 Yeşil | ≥ %80 | Güçlü consensus |
| 🟡 Sarı-yeşil | %60–79 | Orta-güçlü consensus |
| 🟠 Sarı | %40–59 | Zayıf consensus |
| 🔴 Kırmızı | < %40 | Consensus yok |

---

## Offline / Hibrit Kullanım

İnternet bağlantısı olmayan ortamlar için:

1. **Moderatör T2 → Offline Export**: JSON indir, altmoderatörlere e-posta/USB ile ilet.
2. **AltModeratör**: JSON'ı kendi bilgisayarında SubModerator uygulamasına yükler (yerel çalışma), kaydedince JSON indirir.
3. **Moderatör**: Gelen JSON dosyalarını **T2 JSON İmport** ile yükler (çoklu dosya seçimi desteklenir).

---

## Teknik Notlar

- **Firebase Projesi**: `magnetix-ihtiyac-panosu`
- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + @dnd-kit + Firebase
- **Veri güvenliği**: Firestore kuralları `allow read, write: if true` — üretimde kural güncellenmesi önerilir.
- Her uygulama bağımsız Vercel projesi olarak deploy edilir (`root directory` = `expert` / `submoderator` / `moderator`).
