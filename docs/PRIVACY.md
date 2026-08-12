# Gizlilik Politikası

PDFE tüm işlemleri yerel olarak yapar. Uygulama:

- PDF içeriğini hiçbir sunucuya göndermez.
- Analitik, telemetri veya çerez kullanmaz.
- Model dosyalarını eklenti paketinden yükler (çevrimdışı çalışır).
- Kullanıcı verisi toplamaz, saklamaz, paylaşmaz.

PDF dosyaları yalnızca tarayıcı içinde, eklentinin viewer'ında işlenir.

## Teknik Notlar

- Eklenti, görünütlenen belgelerle iletişim için `chrome-extension://` URL'leri ve
  Manifest V3 arka plan/izole dünya mesajlaşmasını kullanır. Bu iletişim tamamen
  tarayıcının içinde kalır ve ağ üzerinden hiçbir istek göndermez.
- Çalışma zamanında dış kaynaklardan dosya indirilmez. Model ve dil dosyaları
  (`tessdata`, ONNX ağırlıkları, ort-wasm) eklenti paketinde gömülüdür
  (bkz. `docs/MODEL_LICENSES.md`). Güncelleme yalnızca eklenti paketi güncellenerek
  yapılır.
- Eklentinin işlediği veri yalnızca etkin durumdaki sekmelerde açık olan PDF'lerdir;
  tarayıcı veya sistemdeki diğer kişisel verilere erişilmez veya saklanmaz.
- PDF tespiti için içerik betiği tüm `http`, `https` ve `file` sayfalarına enjekte
  edilir; açık sayfadaki `embed`/`object`/`iframe` öğelerini ve `location.href`
  değerini okur. Bu inceleme yalnızca PDF'leri tespit etmeye yöneliktir; `tabs`,
  `webNavigation` ve `storage` izinleri bildirilmiş olmasına rağmen hiçbir veri ağ
  üzerinden gönderilmez, saklanmaz ya da paylaşılmaz.