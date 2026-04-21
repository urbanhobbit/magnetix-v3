import type { L1Note, T2Coding, T2Group, CodedItem } from './types';

// ─── Mock L1 Notes (5 uzman, CSV-bazlı çocuk ihtiyaçları) ───────────────────

const EXPERTS = ['Dr. Aylin Kaya', 'Murat Demir', 'Zehra Yıldız', 'Can Arslan', 'Fatma Şen'];

export const MOCK_L1_NOTES: L1Note[] = [
  { id: 'l1_aylin_0', expertName: EXPERTS[0], text: 'Psikososyal Destek\n- Psikolojik danışmanlık hizmeti acil ihtiyaç\n- Psikososyal destek ve kriz müdahalesi programları kurulmalı\n- Menstrüasyon ve ergenlik sağlığı konusunda bilgilendirme\n- Bakımverenin psikososyal desteği çocuğun iyilik hali için kritik\n- Akranlarla sosyal etkileşim fırsatları artırılmalı', timestamp: '2026-04-10T09:00:00Z' },
  { id: 'l1_aylin_1', expertName: EXPERTS[0], text: 'Güvenlik ve Koruma\n- İhmal, istismar ve şiddetten korunma en temel hak\n- Okulda güvenlik hissi sağlanmalı\n- Evde fiziksel güvenlik değerlendirilmeli\n- Siber zorbalıktan korunma programları\n- Güvenli oyun alanlarına erişim şart', timestamp: '2026-04-10T09:10:00Z' },
  { id: 'l1_aylin_2', expertName: EXPERTS[0], text: 'Sağlık\n- Kronik hastalık takibi ve ilaçlara erişim\n- Temel sağlık hizmetlerine erişim\n- Engelli çocuklar için sağlık ve rehabilitasyon\n- Bakım ve hijyen malzemelerine erişim\n- Diş ve göz sağlığı hizmetleri', timestamp: '2026-04-10T09:20:00Z' },
  { id: 'l1_aylin_3', expertName: EXPERTS[0], text: 'Aile Desteği\n- Aile içi iletişim ve destek güçlendirilmeli\n- Çocuk bakım hizmetlerine erişim\n- Sosyal yardımlara erişim kolaylaştırılmalı', timestamp: '2026-04-10T09:30:00Z' },
  { id: 'l1_murat_0', expertName: EXPERTS[1], text: 'Eğitim Altyapısı\n- Okulun fiziki koşulları iyileştirilmeli (sınıf, tuvalet, bahçe, kantin)\n- Sınıf mevcudunun uygunluğu sağlanmalı\n- Eğitim materyallerine erişim\n- Okul yemeğinin sağlıklı ve yeterli olması\n- Okula erişim ve düzenli devam desteklenmeli', timestamp: '2026-04-10T10:00:00Z' },
  { id: 'l1_murat_1', expertName: EXPERTS[1], text: 'Eğitim Kalitesi\n- Rehberlik ve akademik destek güçlendirilmeli\n- Okul öncesi eğitime erişim artırılmalı\n- Okulda kapsayıcı ve ayrımcılıktan uzak ortam\n- Sınavlara hazırlık ve ek ders imkânları\n- Öğretmen ve ebeveyn dijital desteği', timestamp: '2026-04-10T10:10:00Z' },
  { id: 'l1_murat_2', expertName: EXPERTS[1], text: 'Okul Güvenliği\n- Afet ve acil durumlarda çocuk koruma planı\n- Okulda güvenlik hissi\n- Dijital ortamda güvenlik\n- Okula ve kurslara güvenli ulaşım', timestamp: '2026-04-10T10:20:00Z' },
  { id: 'l1_murat_3', expertName: EXPERTS[1], text: 'Beslenme ve Temel\n- Düzenli öğün ve okul yemeği\n- Temel giyim ve mevsimlik kıyafet\n- Sağlıklı yaşam ve beslenme bilgisi', timestamp: '2026-04-10T10:30:00Z' },
  { id: 'l1_zehra_0', expertName: EXPERTS[2], text: 'Temel Yaşam\n- Barınma güvencesi en acil ihtiyaç\n- Gıda ve dengeli beslenmeye erişim\n- Temiz içme suyu\n- Elektrik, su ve internet faturalarının karşılanabilmesi\n- Kira ve borç yükünün yönetilebilirliği\n- Konutun fiziksel güvenliği (deprem, ısınma, nem)', timestamp: '2026-04-10T11:00:00Z' },
  { id: 'l1_zehra_1', expertName: EXPERTS[2], text: 'Ekonomik Destek\n- Düzenli öğün / okul yemeği\n- Temel giyim ve mevsimlik kıyafet\n- Kişisel alan (yatak, masa, dolap)\n- Sosyal yardımlara erişim\n- Bakımverenin ekonomik yükünün hafifletilmesi\n- Çok çocuklu ailelere yönelik destekler', timestamp: '2026-04-10T11:10:00Z' },
  { id: 'l1_zehra_2', expertName: EXPERTS[2], text: 'Aile ve Sosyal Destek\n- Aile içi şiddetten korunma\n- Tek ebeveynli ailelere destek\n- Akraba bakımındaki çocuklar için destek\n- Göçmen ve mülteci çocukların özel ihtiyaçları\n- Sosyal hizmetlere kolay erişim', timestamp: '2026-04-10T11:20:00Z' },
  { id: 'l1_zehra_3', expertName: EXPERTS[2], text: 'Sağlık Erişimi\n- Ücretsiz sağlık hizmetlerine erişim\n- Ruh sağlığı hizmetlerine erişim\n- Engelli çocuklar için rehabilitasyon', timestamp: '2026-04-10T11:30:00Z' },
  { id: 'l1_can_0', expertName: EXPERTS[3], text: 'Dijital Erişim\n- Evde internet erişimi temel ihtiyaç haline geldi\n- Kişisel bilgisayar veya tablet erişimi\n- Dijital okuryazarlık eğitimi\n- Online eğitim platformlarına erişim\n- Yazılım ve lisanslı araçlara erişim', timestamp: '2026-04-10T12:00:00Z' },
  { id: 'l1_can_1', expertName: EXPERTS[3], text: 'Dijital Güvenlik\n- Çocuklar için güvenli internet kullanımı\n- Siber zorbalık farkındalığı\n- Dijital ayak izi ve mahremiyet eğitimi\n- Ebeveyn denetim araçlarına erişim', timestamp: '2026-04-10T12:10:00Z' },
  { id: 'l1_can_2', expertName: EXPERTS[3], text: 'Teknoloji Destekli Eğitim\n- Okulda akıllı tahta ve teknolojik altyapı\n- Programlama ve STEM eğitimine erişim\n- Uzaktan eğitim altyapısı\n- Öğretmenlerin dijital yeterliği', timestamp: '2026-04-10T12:20:00Z' },
  { id: 'l1_can_3', expertName: EXPERTS[3], text: 'Sosyal ve Kültürel Katılım\n- Dijital kültürel içeriklere erişim\n- Online sosyal etkinliklere katılım imkânı\n- Dijital sanat ve yaratıcılık araçları', timestamp: '2026-04-10T12:30:00Z' },
  { id: 'l1_fatma_0', expertName: EXPERTS[4], text: 'Hukuki Haklar\n- Çocuğun temel haklarına erişim ve bilinçlendirme\n- Hukuki destek ve danışmanlığa erişim\n- Kimlik belgelerine erişim (nüfus cüzdanı, pasaport)\n- Ayrımcılığa karşı hukuki koruma\n- Çocuk haklarına dair eğitim', timestamp: '2026-04-10T13:00:00Z' },
  { id: 'l1_fatma_1', expertName: EXPERTS[4], text: 'Güvenlik ve Koruma\n- Çocuk istismarı ve ihmaline karşı koruma mekanizmaları\n- Erken evlilik ve çocuk işçiliğine karşı denetim\n- Mülteci çocukların özel koruma ihtiyacı\n- Çatışma ve afet durumlarında çocuk koruma\n- Okul terk riskine karşı erken müdahale', timestamp: '2026-04-10T13:10:00Z' },
  { id: 'l1_fatma_2', expertName: EXPERTS[4], text: 'Katılım Hakları\n- Çocukların karar süreçlerine katılımı\n- Çocuk meclisleri ve sesini duyurma mekanizmaları\n- Çocuk dostu şikâyet ve başvuru kanalları\n- Gençlik örgütlerine katılım', timestamp: '2026-04-10T13:20:00Z' },
  { id: 'l1_fatma_3', expertName: EXPERTS[4], text: 'Gelecek ve Fırsat Eşitliği\n- Mesleki rehberlik ve kariyer desteği\n- Yükseköğretime erişim imkânları\n- Burs ve maddi destek mekanizmaları\n- Kırsal-kentsel fırsat eşitsizliğinin giderilmesi', timestamp: '2026-04-10T13:30:00Z' },
];

// ─── Mock T2 Coding (2 altmoderatör) ─────────────────────────────────────────

export const MOCK_T2_CODINGS: T2Coding[] = [
  {
    sessionId: 'mock_session',
    subModName: 'AltMod Arzu',
    codedAt: '2026-04-11T09:00:00Z',
    items: [],
    groups: [
      {
        id: 'g1', name: 'Temel Yaşam ve Maddi Güvenlik', category: 'Temel İhtiyaçlar',
        items: [
          { id: 'i1', text: 'Barınma güvencesi', originalText: 'Barınma güvencesi en acil ihtiyaç', expertName: 'Zehra Yıldız', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
          { id: 'i2', text: 'Gıda ve dengeli beslenme', originalText: 'Gıda ve dengeli beslenmeye erişim', expertName: 'Zehra Yıldız', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
          { id: 'i3', text: 'Düzenli öğün ve okul yemeği', originalText: 'Düzenli öğün ve okul yemeği', expertName: 'Murat Demir', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
        ],
      },
      {
        id: 'g2', name: 'Eğitim ve Okul Yaşamı', category: 'Eğitim',
        items: [
          { id: 'i4', text: 'Eğitim materyallerine erişim', originalText: 'Eğitim materyallerine erişim', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
          { id: 'i5', text: 'Rehberlik ve akademik destek', originalText: 'Rehberlik ve akademik destek güçlendirilmeli', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
          { id: 'i6', text: 'Okul öncesi eğitime erişim', originalText: 'Okul öncesi eğitime erişim artırılmalı', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
        ],
      },
      {
        id: 'g3', name: 'Güvenlik ve Koruma', category: 'Güvenlik',
        items: [
          { id: 'i7', text: 'İstismar ve şiddetten korunma', originalText: 'İhmal, istismar ve şiddetten korunma en temel hak', expertName: 'Dr. Aylin Kaya', category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
          { id: 'i8', text: 'Siber zorbalıktan korunma', originalText: 'Siber zorbalıktan korunma programları', expertName: 'Dr. Aylin Kaya', category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
          { id: 'i9', text: 'Erken evlilik ve çocuk işçiliğine karşı denetim', originalText: 'Erken evlilik ve çocuk işçiliğine karşı denetim', expertName: 'Fatma Şen', category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
        ],
      },
      {
        id: 'g4', name: 'Dijital Erişim ve Teknoloji', category: 'Teknoloji',
        items: [
          { id: 'i10', text: 'Evde internet erişimi', originalText: 'Evde internet erişimi temel ihtiyaç haline geldi', expertName: 'Can Arslan', category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
          { id: 'i11', text: 'Kişisel bilgisayar veya tablet', originalText: 'Kişisel bilgisayar veya tablet erişimi', expertName: 'Can Arslan', category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
          { id: 'i12', text: 'Dijital okuryazarlık eğitimi', originalText: 'Dijital okuryazarlık eğitimi', expertName: 'Can Arslan', category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
        ],
      },
    ],
  },
  {
    sessionId: 'mock_session',
    subModName: 'AltMod Burak',
    codedAt: '2026-04-11T11:00:00Z',
    items: [],
    groups: [
      {
        id: 'g1b', name: 'Temel Yaşam ve Maddi Güvenlik', category: 'Temel İhtiyaçlar',
        items: [
          { id: 'i1b', text: 'Barınma güvencesi', originalText: 'Barınma güvencesi en acil ihtiyaç', expertName: 'Zehra Yıldız', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
          { id: 'i2b', text: 'Temiz içme suyu', originalText: 'Temiz içme suyu', expertName: 'Zehra Yıldız', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
          { id: 'i3b', text: 'Temel giyim ve mevsimlik kıyafet', originalText: 'Temel giyim ve mevsimlik kıyafet', expertName: 'Murat Demir', category: 'Temel İhtiyaçlar', group: 'Temel Yaşam ve Maddi Güvenlik' },
        ],
      },
      {
        id: 'g2b', name: 'Eğitim ve Okul Yaşamı', category: 'Eğitim',
        items: [
          { id: 'i4b', text: 'Eğitim materyallerine erişim', originalText: 'Eğitim materyallerine erişim', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
          { id: 'i5b', text: 'Okul fiziki koşulları iyileştirilmeli', originalText: 'Okulun fiziki koşulları iyileştirilmeli', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
          { id: 'i6b', text: 'Kapsayıcı ve ayrımcılıktan uzak okul ortamı', originalText: 'Okulda kapsayıcı ve ayrımcılıktan uzak ortam', expertName: 'Murat Demir', category: 'Eğitim', group: 'Eğitim ve Okul Yaşamı' },
        ],
      },
      {
        id: 'g3b', name: 'Güvenlik ve Koruma', category: 'Güvenlik',
        items: [
          { id: 'i7b', text: 'İstismar ve şiddetten korunma', originalText: 'Çocuk istismarı ve ihmaline karşı koruma mekanizmaları', expertName: 'Fatma Şen', category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
          { id: 'i8b', text: 'Mülteci çocukların özel koruma ihtiyacı', originalText: 'Mülteci çocukların özel koruma ihtiyacı', expertName: 'Fatma Şen', category: 'Güvenlik', group: 'Güvenlik ve Koruma' },
        ],
      },
      {
        id: 'g4b', name: 'Dijital Erişim ve Teknoloji', category: 'Teknoloji',
        items: [
          { id: 'i10b', text: 'Evde internet erişimi', originalText: 'Evde internet erişimi temel ihtiyaç haline geldi', expertName: 'Can Arslan', category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
          { id: 'i11b', text: 'Programlama ve STEM eğitimi', originalText: 'Programlama ve STEM eğitimine erişim', expertName: 'Can Arslan', category: 'Teknoloji', group: 'Dijital Erişim ve Teknoloji' },
        ],
      },
      {
        id: 'g5b', name: 'Sağlık ve Psikososyal İyi Oluş', category: 'Sağlık',
        items: [
          { id: 'i13b', text: 'Psikolojik danışmanlık hizmeti', originalText: 'Psikolojik danışmanlık hizmeti acil ihtiyaç', expertName: 'Dr. Aylin Kaya', category: 'Sağlık', group: 'Sağlık ve Psikososyal İyi Oluş' },
          { id: 'i14b', text: 'Temel sağlık hizmetlerine erişim', originalText: 'Temel sağlık hizmetlerine erişim', expertName: 'Dr. Aylin Kaya', category: 'Sağlık', group: 'Sağlık ve Psikososyal İyi Oluş' },
        ],
      },
    ],
  },
];
