// Từ điển giải thích thuật ngữ hiển thị trong ngăn "Giải thích" và chú thích khi rê chuột.
export const GLOSSARY = [
  // ───────────── Bookmap ─────────────
  {
    id: "bookmap",
    group: "Bookmap",
    term: "Bookmap (bản đồ nhiệt sổ lệnh)",
    short: "Hình ảnh sổ lệnh theo thời gian: màu càng sáng ở mức giá nào thì càng nhiều lệnh chờ ở đó.",
    body: "<p>Bookmap vẽ lại sổ lệnh (các lệnh mua/bán đang chờ khớp) theo thời gian. Trục ngang là thời gian, trục dọc là giá. Mỗi điểm màu cho biết tại thời điểm đó, ở mức giá đó có bao nhiêu lệnh đang chờ.</p><p><b>Cách đọc:</b></p><ul><li>Màu xanh đậm = rất ít lệnh chờ.</li><li>Vàng, cam, trắng = rất nhiều lệnh chờ, thường gọi là “tường thanh khoản”.</li><li>Đường xanh lá = giá mua tốt nhất (bid), đường đỏ = giá bán tốt nhất (ask). Giá thực tế nằm giữa hai đường này.</li></ul><p><b>Ví dụ:</b> BTC đang ở 62.300 USDT, bạn thấy một dải vàng sáng kéo dài ngang ở 62.000. Nghĩa là ở 62.000 có nhiều người đặt lệnh mua chờ, giá đi xuống đó dễ bị chặn lại.</p><p><b>Lưu ý:</b> Lệnh chờ có thể bị huỷ bất cứ lúc nào, nên dải sáng không đảm bảo giá sẽ dừng ở đó.</p>"
  },
  {
    id: "liquidity-wall",
    group: "Bookmap",
    term: "Tường thanh khoản",
    short: "Một mức giá có lượng lệnh chờ lớn bất thường, có thể chặn giá lại — nhưng cũng có thể bị rút đi (spoofing).",
    body: "<p>Tường thanh khoản là một mức giá có rất nhiều lệnh chờ mua hoặc chờ bán so với các mức xung quanh. Trên Bookmap nó hiện thành một dải ngang màu vàng/cam/trắng.</p><p><b>Cách đọc:</b> Tường dưới giá (lệnh chờ mua) có thể làm “đệm đỡ”; tường trên giá (lệnh chờ bán) có thể làm “trần”. Nếu giá chạm tường và tường bị ăn dần (dải nhạt đi trong khi có nhiều bong bóng khớp), tường có thể sắp bị phá.</p><p><b>Ví dụ:</b> ETH ở 2.450, có tường bán 3.000 ETH ở 2.480. Giá lên 2.478 rồi quay đầu nhiều lần — tường đang giữ.</p><p><b>Lưu ý (spoofing):</b> Có người đặt tường lớn để doạ thị trường rồi rút ngay khi giá đến gần. Nếu dải sáng biến mất đột ngột mà không có lệnh khớp, đó là tường giả.</p>"
  },
  {
    id: "trade-bubble",
    group: "Bookmap",
    term: "Bong bóng lệnh khớp",
    short: "Mỗi vòng tròn là lệnh vừa khớp: xanh lá = mua chủ động, đỏ = bán chủ động, càng to càng nhiều khối lượng.",
    body: "<p>Bong bóng là các lệnh đã thực sự khớp, vẽ đè lên Bookmap đúng thời điểm và mức giá khớp.</p><p><b>Cách đọc:</b></p><ul><li>Xanh lá = người mua chủ động (đặt lệnh market mua, ăn vào lệnh chờ bán).</li><li>Đỏ = người bán chủ động.</li><li>Bong bóng càng to thì khối lượng khớp càng lớn.</li></ul><p><b>Ví dụ:</b> Giá BTC chạm tường mua ở 62.000 và xuất hiện một loạt bong bóng đỏ to nhưng giá không giảm thêm — người mua chờ đang “hấp thụ” lực bán, thường là dấu hiệu đỡ giá.</p>"
  },
  {
    id: "big-trade",
    group: "Bookmap",
    term: "Lệnh lớn",
    short: "Lệnh khớp thuộc nhóm 0,5% lớn nhất kể từ lúc mở trang, được đánh dấu bằng vòng trắng.",
    body: "<p>Lệnh lớn là những lệnh khớp có kích thước lớn hơn hẳn bình thường, thường do quỹ hoặc “cá voi” đặt.</p><p><b>Cách đọc:</b> Ứng dụng đánh dấu bằng vòng tròn trắng. Ngưỡng được tính tự động: lệnh thuộc top 0,5% lớn nhất trong tất cả lệnh khớp kể từ khi bạn mở trang.</p><p><b>Ví dụ:</b> Nếu 99,5% lệnh BTC nhỏ hơn 4 BTC, thì lệnh 5 BTC sẽ có vòng trắng.</p><p><b>Lưu ý:</b> Vừa mở trang thì có ít dữ liệu, ngưỡng còn chưa ổn định. Đợi vài phút để ngưỡng chính xác hơn.</p>"
  },
  {
    id: "contrast",
    group: "Bookmap",
    term: "Thanh tương phản",
    short: "Chỉnh độ nhạy màu của Bookmap: tăng để thấy cả lệnh chờ nhỏ, giảm để chỉ thấy các tường lớn.",
    body: "<p>Thanh tương phản quyết định bao nhiêu lệnh chờ thì được tô sáng.</p><p><b>Cách đọc:</b> Kéo lên cao: các lượng lệnh chờ vừa phải cũng hiện màu vàng/cam, hình nhiều chi tiết hơn. Kéo xuống thấp: chỉ những tường thật lớn mới sáng, dễ nhìn ra mức quan trọng.</p><p><b>Ví dụ:</b> Khi thị trường đông đúc và cả màn hình đều vàng, hãy giảm tương phản để lộ ra 1-2 tường lớn nhất.</p>"
  },
  {
    id: "grid",
    group: "Bookmap",
    term: "Tầng giá (gộp mức giá)",
    short: "Gộp các mức giá gần nhau thành một hàng để hình gọn và dễ thấy vùng tập trung lệnh hơn.",
    body: "<p>Sàn chia giá thành các bước rất nhỏ (ví dụ BTC bước 0,1 USDT). Xem từng bước thì quá vụn. Tầng giá gộp nhiều bước liền nhau thành một hàng.</p><p><b>Ví dụ:</b> Tầng giá 10 USDT nghĩa là mọi lệnh chờ từ 62.000 đến 62.009,9 được cộng chung vào hàng 62.000.</p><p><b>Lưu ý:</b> Tầng lớn giúp thấy bức tranh tổng thể; tầng nhỏ giúp thấy chi tiết nhưng rối mắt hơn.</p>"
  },

  // ───────────── Footprint ─────────────
  {
    id: "footprint",
    group: "Footprint",
    term: "Footprint (nến dấu chân)",
    short: "Nến được mổ xẻ theo từng mức giá: mỗi ô cho biết bán chủ động × mua chủ động tại giá đó.",
    body: "<p>Nến thường chỉ cho biết giá mở, cao, thấp, đóng. Footprint cho xem bên trong nến: ở mỗi mức giá, bao nhiêu khối lượng là do người bán chủ động và bao nhiêu do người mua chủ động.</p><p><b>Cách đọc:</b> Mỗi ô có dạng <b>bán × mua</b>: số bên trái là khối lượng bán chủ động, số bên phải là khối lượng mua chủ động tại mức giá đó.</p><p><b>Ví dụ:</b> Ô “120 × 15” ở 62.400 nghĩa là tại 62.400 có 120 BTC bị bán chủ động nhưng chỉ 15 BTC mua chủ động — phe bán chiếm ưu thế ở mức đó.</p>"
  },
  {
    id: "poc-bar",
    group: "Footprint",
    term: "POC của nến",
    short: "Ô có khung vàng: mức giá khớp nhiều khối lượng nhất trong nến đó.",
    body: "<p>POC (Point of Control) của nến là mức giá có tổng khối lượng (mua + bán) lớn nhất bên trong một nến.</p><p><b>Cách đọc:</b> Ô có khung vàng trên footprint. POC nằm gần đỉnh nến thường cho thấy nhiều người giao dịch ở vùng cao; nằm gần đáy là vùng thấp.</p><p><b>Ví dụ:</b> Nến 15 phút BTC từ 62.100 đến 62.600, POC ở 62.550. Nếu nến sau giảm xuống dưới 62.550, những người mua nhiều ở đó đang bị lỗ và có thể bán ra.</p>"
  },
  {
    id: "imbalance",
    group: "Footprint",
    term: "Mất cân bằng (Imbalance)",
    short: "Khi một phe áp đảo phe kia gấp 3 lần trở lên ở hai mức giá chéo nhau, chữ được tô xanh/đỏ sáng.",
    body: "<p>Mất cân bằng là khi mua chủ động gấp ít nhất 3 lần bán chủ động (hoặc ngược lại), so chéo giữa hai mức giá liền nhau.</p><p><b>Cách đọc:</b> Số mua được tô xanh sáng = phe mua áp đảo; số bán tô đỏ sáng = phe bán áp đảo. Nhiều ô mất cân bằng xếp chồng liên tiếp cho thấy một phe đang đẩy giá rất mạnh.</p><p><b>Ví dụ:</b> Ở 62.400 có bán 20, ở 62.410 có mua 75. 75 / 20 = 3,75 &gt; 3 → ô mua 75 sáng xanh.</p>"
  },
  {
    id: "footprint-approx",
    group: "Footprint",
    term: "Footprint ước tính (viền nét đứt)",
    short: "Nến cũ có viền nét đứt được ước tính từ dữ liệu nhỏ hơn vì sàn không cho tải từng lệnh khớp trong quá khứ.",
    body: "<p>Để dựng footprint chính xác cần biết từng lệnh khớp. Sàn chỉ cho tải chi tiết này trong khoảng gần đây; với nến cũ hơn ứng dụng phải ước tính.</p><p><b>Cách đọc:</b></p><ul><li>Nến viền nét đứt = ước tính từ nến 1 phút hoặc dữ liệu khung nhỏ hơn. Hình dáng tổng thể đúng, nhưng con số từng ô chỉ là gần đúng.</li><li>Nến viền liền = dựng từ từng lệnh khớp thật, tin cậy được.</li></ul><p><b>Lưu ý:</b> Đừng dựa vào từng ô mất cân bằng nhỏ trên nến nét đứt để ra quyết định.</p>"
  },
  {
    id: "delta",
    group: "Footprint",
    term: "Delta",
    short: "Mua chủ động trừ bán chủ động trong một nến; dương là phe mua mạnh hơn, âm là phe bán mạnh hơn.",
    body: "<p>Delta = khối lượng mua chủ động − khối lượng bán chủ động trong một nến.</p><p><b>Cách đọc:</b> Delta dương (xanh) = người mua sốt sắng hơn; âm (đỏ) = người bán sốt sắng hơn. Khi thấy chữ “ước tính từ nến”, nghĩa là sàn không cung cấp khối lượng mua chủ động nên ứng dụng đoán dựa trên hình dạng nến.</p><p><b>Ví dụ:</b> Nến 5 phút có mua chủ động 800 BTC, bán chủ động 500 BTC → delta = +300.</p><p><b>Lưu ý:</b> Giá tăng mà delta âm (hoặc ngược lại) là dấu hiệu phân kỳ, có thể có người lớn đang hấp thụ lệnh.</p>"
  },
  {
    id: "dom",
    group: "Footprint",
    term: "DOM (sổ lệnh bậc thang)",
    short: "Sổ lệnh xếp theo từng bậc giá, cho thấy lệnh chờ mua, chờ bán và khối lượng vừa khớp tại từng giá.",
    body: "<p>DOM (Depth of Market) là bảng dọc, mỗi hàng là một mức giá.</p><p><b>Các cột:</b></p><ul><li><b>Khớp:</b> bong bóng lệnh khớp trong 60 giây gần nhất.</li><li><b>Đã khớp tại giá:</b> tổng khối lượng đã khớp ở mức đó.</li><li><b>Chờ mua:</b> lệnh chờ mua (bid).</li><li><b>Giá.</b></li><li><b>Chờ bán:</b> lệnh chờ bán (ask).</li></ul><p><b>Gộp x1/x5/x50:</b> gộp 1, 5 hoặc 50 bước giá thành một hàng để nhìn rộng hơn.</p><p><b>Ví dụ:</b> Cột chờ bán ở 62.500 có 450 BTC, lớn hơn hẳn các hàng khác — đó là một tường bán.</p>"
  },

  // ───────────── Dòng lệnh ─────────────
  {
    id: "aggressor",
    group: "Dòng lệnh",
    term: "Mua / bán chủ động",
    short: "Người dùng lệnh market “ăn” ngay vào lệnh chờ của người khác — họ là bên chủ động, sốt ruột muốn khớp ngay.",
    body: "<p>Mỗi giao dịch có hai bên: một bên đặt lệnh chờ (limit) và một bên đặt lệnh khớp ngay (market). Bên đặt lệnh market là bên <b>chủ động</b>.</p><p><b>Cách đọc:</b> Mua chủ động = người mua chấp nhận giá bán đang chào, đẩy giá lên. Bán chủ động = người bán chấp nhận giá mua đang chờ, đẩy giá xuống.</p><p><b>Ví dụ:</b> Có lệnh chờ bán 2 BTC ở 62.010. Bạn bấm “Mua market 2 BTC” → khớp ở 62.010, đây là 2 BTC mua chủ động.</p>"
  },
  {
    id: "cvd",
    group: "Dòng lệnh",
    term: "CVD (Cumulative Volume Delta)",
    short: "Tổng cộng dồn của delta qua thời gian: đường đi lên là phe mua chủ động áp đảo, đi xuống là phe bán.",
    body: "<p>CVD là delta (mua chủ động − bán chủ động) của từng nến cộng dồn liên tục.</p><p><b>Cách đọc:</b> Xem hướng của đường, không phải con số tuyệt đối. CVD đi lên = dòng tiền mua chủ động; đi xuống = dòng tiền bán chủ động.</p><p><b>Ví dụ:</b> BTC đi ngang quanh 62.000 nhưng CVD giảm từ +5.000 xuống −2.000 BTC — người bán đang xả liên tục nhưng có ai đó đỡ giá. Nếu người đỡ rút đi, giá có thể giảm mạnh.</p><p><b>Lưu ý:</b> Giá lên mà CVD xuống (phân kỳ) là tín hiệu cảnh giác, nhưng không tự nó là tín hiệu vào lệnh.</p>"
  },
  {
    id: "oi",
    group: "Dòng lệnh",
    term: "OI (Open Interest — hợp đồng mở)",
    short: "Tổng số hợp đồng tương lai đang mở; tăng là tiền mới vào thị trường, giảm là người ta đang đóng vị thế.",
    body: "<p>Open Interest là tổng giá trị các hợp đồng futures chưa đóng. Mỗi khi có một người mở long và một người mở short mới, OI tăng.</p><p><b>Cách đọc:</b></p><ul><li>OI tăng + giá tăng = tiền mới vào mở long.</li><li>OI tăng + giá giảm = tiền mới vào mở short.</li><li>OI giảm = người ta đóng vị thế hoặc bị thanh lý.</li></ul><p><b>Ví dụ:</b> OI BTC tăng từ 8,0 tỷ lên 8,4 tỷ USDT trong khi giá giảm 2% → nhiều short mới. Nếu giá bật lên, các short này có thể bị ép đóng, đẩy giá lên nhanh hơn.</p>"
  },
  {
    id: "cvd-oi-combo",
    group: "Dòng lệnh",
    term: "Đọc CVD và OI cùng nhau",
    short: "Kết hợp hướng của CVD và OI để biết ai đang chủ động và đó là tiền mới vào hay tiền đang rút ra.",
    body: "<p>CVD cho biết ai đang chủ động (mua hay bán). OI cho biết tiền mới vào hay đang rút ra. Ghép lại có 4 trường hợp:</p><ul><li><b>CVD lên + OI lên:</b> mua chủ động mở long mới — xu hướng tăng khoẻ.</li><li><b>CVD lên + OI xuống:</b> short đang mua lại để đóng (short squeeze) — tăng nhanh nhưng dễ hụt hơi.</li><li><b>CVD xuống + OI lên:</b> bán chủ động mở short mới — xu hướng giảm khoẻ.</li><li><b>CVD xuống + OI xuống:</b> long đang bán ra để đóng hoặc bị thanh lý — giảm nhanh, thường sắp cạn lực.</li></ul><p><b>Ví dụ:</b> ETH tăng 3%, CVD đi lên nhưng OI giảm 4% → cú tăng chủ yếu do short đóng lệnh, chưa chắc có người mua mới đi theo.</p>"
  },

  // ───────────── Thanh lý ─────────────
  {
    id: "liquidation",
    group: "Thanh lý",
    term: "Thanh lý (Liquidation)",
    short: "Sàn đóng cưỡng bức vị thế khi lỗ hết ký quỹ: kim cương hồng = long bị thanh lý, vàng = short bị thanh lý.",
    body: "<p>Khi giao dịch đòn bẩy bị lỗ đến mức hết tiền ký quỹ, sàn tự động đóng vị thế. Đó là thanh lý.</p><p><b>Cách đọc:</b></p><ul><li>Kim cương hồng = long bị thanh lý (sàn bán cưỡng bức).</li><li>Kim cương vàng = short bị thanh lý (sàn mua cưỡng bức).</li><li>Kim cương càng to, giá trị thanh lý càng lớn.</li></ul><p><b>Ví dụ:</b> BTC rơi từ 62.000 xuống 60.500 trong 5 phút, xuất hiện cả chùm kim cương hồng — long đòn bẩy cao đang bị quét. Chuỗi thanh lý lớn thường đánh dấu gần đáy ngắn hạn.</p><p><b>Lưu ý:</b> Sàn chỉ công bố một phần lệnh thanh lý, con số thật thường lớn hơn.</p>"
  },
  {
    id: "liq-map",
    group: "Thanh lý",
    term: "Bản đồ thanh lý ước tính",
    short: "Ước tính nơi nhiều vị thế có thể bị thanh lý, dựa trên OI và đòn bẩy phổ biến; càng sáng càng nhiều.",
    body: "<p>Đây là <b>ước tính</b>, không phải dữ liệu thật. Ứng dụng xem OI tăng ở mức giá nào (có người mở vị thế ở đó), rồi giả định họ dùng đòn bẩy phổ biến 5x, 10x, 25x, 50x, 100x để tính ra giá thanh lý của họ.</p><p><b>Cách đọc:</b> Cụm càng sáng = càng nhiều vị thế có thể bị thanh lý ở mức giá đó. Giá hay bị “hút” về các cụm lớn vì ở đó có nhiều thanh khoản (lệnh cưỡng bức) cho người lớn khớp lệnh.</p><p><b>Ví dụ:</b> Nhiều long mở ở 62.000 với 25x → giá thanh lý khoảng 62.000 × (1 − 1/25) ≈ 59.520. Bản đồ sẽ có cụm sáng quanh 59.500.</p><p><b>Lưu ý:</b> Không ai biết chính xác người khác dùng đòn bẩy bao nhiêu; hãy coi đây là bản đồ tham khảo.</p>"
  },
  {
    id: "liq-windows",
    group: "Thanh lý",
    term: "Bảng thanh lý theo khung thời gian",
    short: "Tổng hợp thanh lý thật trong 15 phút, 1 giờ, 4 giờ và 24 giờ gần nhất, kèm OI và giá thay đổi.",
    body: "<p>Bảng có các hàng 15 phút / 1h / 4h / 24h. Mỗi hàng cho biết:</p><ul><li>Tổng giá trị long bị thanh lý và short bị thanh lý.</li><li>Tỷ lệ L/S (long chia short).</li><li>Số lệnh thanh lý, lệnh lớn nhất.</li><li>OI thay đổi và giá thay đổi trong khoảng đó.</li></ul><p><b>Cột “Dữ liệu từ”:</b> dữ liệu thanh lý thật chỉ có từ lúc bạn mở trang, hoặc từ dữ liệu đã lưu trong trình duyệt lần trước. Nếu bạn mới mở trang 20 phút thì hàng 24h thực ra chỉ có 20 phút dữ liệu — cột này cho bạn biết độ phủ thật.</p><p><b>Ví dụ:</b> Hàng 1h: long 12,4 triệu, short 1,1 triệu, giá −1,8%, OI −3% → một đợt quét long rõ rệt.</p>"
  },
  {
    id: "liq-ls-ratio",
    group: "Thanh lý",
    term: "Tỷ lệ L/S thanh lý",
    short: "Giá trị long bị thanh lý chia cho short bị thanh lý; lớn hơn 1 là phe long đang chịu thiệt nhiều hơn.",
    body: "<p>L/S = tổng long bị thanh lý ÷ tổng short bị thanh lý trong cùng khoảng thời gian.</p><p><b>Cách đọc:</b> L/S &gt; 1: long bị quét nhiều hơn (giá thường vừa giảm). L/S &lt; 1: short bị quét nhiều hơn (giá thường vừa tăng). Gần 1: hai bên cân bằng.</p><p><b>Ví dụ:</b> Long 9 triệu, short 1,5 triệu → L/S = 6. Phe long đang bị xả mạnh; khi tỷ lệ cực đoan như vậy, lực bán cưỡng bức thường sắp cạn.</p>"
  },
  {
    id: "liq-cluster-up",
    group: "Thanh lý",
    term: "Cụm thanh lý phía trên giá",
    short: "Vùng phía trên giá hiện tại nơi nhiều short có thể bị thanh lý; giá lên đến đó dễ bị đẩy vọt.",
    body: "<p>Short bị thanh lý khi giá tăng, nên các cụm phía trên giá chủ yếu là short.</p><p><b>Cách đọc:</b> Nếu giá tiến lên cụm này, các short bị đóng cưỡng bức = lệnh mua market, có thể làm giá vọt lên thêm (short squeeze).</p><p><b>Ví dụ:</b> BTC ở 62.000, cụm sáng ở 63.200. Giá phá 63.000 có thể nhanh chóng chạm 63.200–63.400 do chuỗi thanh lý.</p>"
  },
  {
    id: "liq-cluster-down",
    group: "Thanh lý",
    term: "Cụm thanh lý phía dưới giá",
    short: "Vùng phía dưới giá hiện tại nơi nhiều long có thể bị thanh lý; giá rơi đến đó dễ bị đạp sâu hơn.",
    body: "<p>Long bị thanh lý khi giá giảm, nên các cụm phía dưới giá chủ yếu là long.</p><p><b>Cách đọc:</b> Giá đi xuống chạm cụm → long bị bán cưỡng bức → giá rơi nhanh hơn (long squeeze). Sau khi cụm bị quét sạch, giá thường hồi lên vì lực bán cưỡng bức đã hết.</p><p><b>Ví dụ:</b> ETH ở 2.450, cụm sáng ở 2.380. Một cú rơi xuống 2.375 rồi bật lên 2.420 là kiểu “quét thanh lý” rất hay gặp.</p>"
  },

  // ───────────── Hỗ trợ / kháng cự ─────────────
  {
    id: "sr-level",
    group: "Hỗ trợ / kháng cự",
    term: "Mức hỗ trợ / kháng cự",
    short: "Mức giá mà trước đây giá nhiều lần quay đầu; HT (xanh) ở dưới đỡ giá, KC (đỏ) ở trên chặn giá.",
    body: "<p>Ứng dụng tìm các đỉnh và đáy nơi giá đổi chiều, rồi gom những đỉnh/đáy ở gần nhau thành một mức.</p><p><b>Cách đọc:</b></p><ul><li><b>HT</b> (hỗ trợ) màu xanh: mức dưới giá, nơi trước đây người mua thường vào.</li><li><b>KC</b> (kháng cự) màu đỏ: mức trên giá, nơi trước đây người bán thường ra.</li><li>Nét đứt = mức đã bị phá.</li></ul><p><b>Ví dụ:</b> BTC đã tạo đáy ở 60.050, 59.980 và 60.020 → ứng dụng gom thành HT 60.000.</p>"
  },
  {
    id: "sr-touches",
    group: "Hỗ trợ / kháng cự",
    term: "Số lần chạm",
    short: "Số đỉnh hoặc đáy xoay chiều đã tạo nên mức này; càng nhiều lần chạm thì mức càng được thị trường công nhận.",
    body: "<p>Số lần chạm là số điểm đảo chiều (đỉnh hoặc đáy) được gom lại thành mức hỗ trợ/kháng cự.</p><p><b>Ví dụ:</b> KC 65.000 có 4 lần chạm nghĩa là có 4 đỉnh khác nhau được tạo ra quanh 65.000.</p><p><b>Lưu ý:</b> Mức bị chạm quá nhiều lần cũng có thể yếu đi, vì lệnh chờ ở đó bị tiêu hao dần.</p>"
  },
  {
    id: "sr-tests",
    group: "Hỗ trợ / kháng cự",
    term: "Số lần test",
    short: "Số lần giá quay lại chạm mức rồi bị đẩy ngược lại — cho thấy mức vẫn đang có tác dụng.",
    body: "<p>Khác với số lần chạm (các đỉnh/đáy tạo ra mức), số lần test đếm những lần giá <b>quay lại</b> mức sau khi đã hình thành và bị đẩy lùi.</p><p><b>Ví dụ:</b> HT 2.400 của ETH được tạo, sau đó giá xuống 2.403 rồi bật lên, lần khác xuống 2.398 rồi bật lên → 2 lần test.</p>"
  },
  {
    id: "sr-strength",
    group: "Hỗ trợ / kháng cự",
    term: "Độ mạnh (0–100)",
    short: "Điểm tổng hợp từ số lần chạm, số lần test, độ gần đây và khối lượng giao dịch tại mức đó.",
    body: "<p>Độ mạnh gom nhiều yếu tố thành một con số từ 0 đến 100:</p><ul><li>Số lần chạm và số lần test (càng nhiều càng mạnh).</li><li>Độ gần đây (mức mới hình thành gần đây được coi trọng hơn).</li><li>Khối lượng giao dịch tại mức đó.</li></ul><p><b>Cách đọc:</b> Trên 70 là mức đáng chú ý; dưới 30 là mức yếu, dễ bị phá.</p><p><b>Lưu ý:</b> Độ mạnh cao không có nghĩa là chắc chắn giữ — chỉ là xác suất phản ứng cao hơn.</p>"
  },
  {
    id: "sr-status",
    group: "Hỗ trợ / kháng cự",
    term: "Trạng thái mức",
    short: "Còn giữ = chưa bị phá; Đã bị phá = giá đã đóng cửa xuyên qua; Đã đảo vai = hỗ trợ thành kháng cự hoặc ngược lại.",
    body: "<ul><li><b>Còn giữ:</b> giá chưa đóng cửa xuyên qua mức.</li><li><b>Đã bị phá:</b> giá đã đóng cửa vượt qua mức, mức hiện nét đứt.</li><li><b>Đã đảo vai:</b> sau khi bị phá, mức đổi vai trò — hỗ trợ cũ thành kháng cự mới và ngược lại.</li></ul><p><b>Ví dụ:</b> HT 60.000 bị phá, giá xuống 59.000 rồi hồi lên 60.000 và bị đẩy xuống lại → 60.000 giờ là kháng cự (đã đảo vai).</p>"
  },
  {
    id: "abnormal-volume",
    group: "Hỗ trợ / kháng cự",
    term: "Vùng khối lượng bất thường",
    short: "Nến có khối lượng cao bất thường so với 50 nến trước; vùng giá từ đáy đến đỉnh của nến đó thường thành vùng quan trọng.",
    body: "<p>Khi một nến có khối lượng vượt xa mức bình thường của 50 nến trước, thường là có người lớn vào/ra lệnh. Vùng giá của nến đó (từ giá thấp nhất đến cao nhất) được đánh dấu.</p><p><b>Cách đọc:</b> Giá quay lại vùng này thường phản ứng, vì những người đã giao dịch nhiều ở đó sẽ bảo vệ vị thế hoặc thoát hoà vốn.</p><p><b>Ví dụ:</b> Nến 1h BTC khối lượng 9.000 BTC trong khi trung bình 2.500, vùng 61.200–61.900 → đây là vùng đáng chú ý.</p>"
  },
  {
    id: "sigma",
    group: "Hỗ trợ / kháng cự",
    term: "Độ lệch σ (sigma)",
    short: "Cho biết khối lượng cao bất thường đến mức nào; 3σ là chuyện chỉ xảy ra khoảng 1 lần trong 1.000.",
    body: "<p>σ (đọc là “sigma”) là thước đo “bình thường thì khối lượng dao động lên xuống khoảng bao nhiêu”.</p><p><b>Cách đọc:</b> “2.8σ” nghĩa là khối lượng nến này cao hơn trung bình một khoảng bằng 2,8 lần mức dao động thông thường.</p><ul><li>1σ: khá thường gặp.</li><li>2σ: hiếm, khoảng 2–3% số nến.</li><li>3σ: rất hiếm, khoảng 0,1%.</li></ul><p><b>Ví dụ:</b> Trung bình 1.000 BTC, dao động thông thường 300 BTC. Nến có 1.900 BTC → (1.900 − 1.000) / 300 = 3σ.</p><p><b>Lưu ý:</b> Thị trường crypto hay có cú bất thường nên các mức 3σ xuất hiện thường hơn lý thuyết.</p>"
  },
  {
    id: "zone-status",
    group: "Hỗ trợ / kháng cự",
    term: "Trạng thái vùng",
    short: "Còn hiệu lực = chưa có nến nào đóng cửa xuyên sang phía bên kia vùng; Đã bị xuyên qua = vùng mất tác dụng.",
    body: "<ul><li><b>Còn hiệu lực:</b> chưa có nến nào đóng cửa vượt hẳn sang phía bên kia của vùng. Vùng vẫn có thể đỡ hoặc chặn giá.</li><li><b>Đã bị xuyên qua:</b> đã có nến đóng cửa bên kia vùng, vùng bị phá và không còn đáng tin.</li></ul><p><b>Ví dụ:</b> Vùng 61.200–61.900. Giá xuống 61.100 nhưng nến đóng ở 61.400 → vẫn còn hiệu lực. Nến đóng ở 61.000 → đã bị xuyên qua.</p>"
  },

  // ───────────── Xu hướng & động lượng ─────────────
  {
    id: "trend-score",
    group: "Xu hướng & động lượng",
    term: "Điểm xu hướng (−100 đến 100)",
    short: "Một con số tóm tắt xu hướng: gần +100 là tăng mạnh và đều, gần −100 là giảm mạnh và đều, quanh 0 là đi ngang.",
    body: "<p>Điểm xu hướng kết hợp ba yếu tố:</p><ul><li><b>Độ dốc:</b> giá đi lên/xuống nhanh cỡ nào so với biên độ dao động thường (ATR).</li><li><b>Độ khớp R²:</b> giá đi thẳng hay lởm chởm (0 = lộn xộn, 1 = thẳng tắp).</li><li><b>Cấu trúc đỉnh đáy:</b> có tạo đỉnh/đáy cao dần hay thấp dần không.</li></ul><p><b>Ví dụ:</b> +72 = xu hướng tăng rõ. −15 = hơi nghiêng giảm nhưng chưa rõ ràng.</p><p><b>Lưu ý:</b> Điểm cao cho biết xu hướng đã diễn ra, không đảm bảo sẽ tiếp tục.</p>"
  },
  {
    id: "structure",
    group: "Xu hướng & động lượng",
    term: "Cấu trúc thị trường",
    short: "HH-HL = đỉnh và đáy cao dần (tăng); LH-LL = đỉnh và đáy thấp dần (giảm); Hỗn hợp = không rõ.",
    body: "<ul><li><b>HH-HL</b> (Higher High – Higher Low): đỉnh sau cao hơn đỉnh trước, đáy sau cao hơn đáy trước → xu hướng tăng.</li><li><b>LH-LL</b> (Lower High – Lower Low): đỉnh và đáy thấp dần → xu hướng giảm.</li><li><b>Hỗn hợp:</b> các đỉnh đáy lẫn lộn, thường là đi ngang.</li></ul><p><b>Ví dụ:</b> Đáy 58.000 → đỉnh 61.000 → đáy 59.500 → đỉnh 62.500: đây là HH-HL.</p>"
  },
  {
    id: "momentum",
    group: "Xu hướng & động lượng",
    term: "Động lượng",
    short: "Tốc độ giá thay đổi trong 10 nến và tỷ lệ mua/bán chủ động trong 20 nến, cho biết xu hướng đang nhanh lên hay chậm lại.",
    body: "<p>Động lượng xem hai thứ: giá thay đổi bao nhiêu % trong 10 nến gần nhất và phe nào chủ động hơn trong 20 nến gần nhất.</p><p><b>Các nhãn:</b></p><ul><li><b>Tăng tốc lên:</b> đang tăng và tăng ngày càng nhanh.</li><li><b>Tăng chậm lại:</b> vẫn tăng nhưng yếu dần.</li><li><b>Giảm tốc xuống:</b> đang giảm và giảm ngày càng nhanh.</li><li><b>Giảm chậm lại:</b> vẫn giảm nhưng lực bán yếu dần.</li><li><b>Trung tính:</b> không có lực rõ ràng.</li></ul><p><b>Ví dụ:</b> Giá tăng 3% trong 10 nến nhưng tỷ lệ mua chủ động giảm từ 60% xuống 48% → “Tăng chậm lại”.</p>"
  },
  {
    id: "roc",
    group: "Xu hướng & động lượng",
    term: "ROC (thay đổi 10 nến)",
    short: "Giá hiện tại thay đổi bao nhiêu phần trăm so với 10 nến trước.",
    body: "<p>ROC (Rate of Change) = (giá hiện tại − giá 10 nến trước) ÷ giá 10 nến trước × 100%.</p><p><b>Ví dụ:</b> Trên khung 1h, 10 giờ trước BTC 60.000, giờ 61.800 → ROC = +3%.</p><p><b>Lưu ý:</b> Cùng con số ROC nhưng ở khung 5 phút và khung 1 ngày mang ý nghĩa rất khác nhau.</p>"
  },
  {
    id: "mtf",
    group: "Xu hướng & động lượng",
    term: "Đa khung thời gian",
    short: "Xem 5m, 15m, 1h, 4h, 1d cùng lúc để biết xu hướng ngắn hạn có cùng chiều với xu hướng lớn hay không.",
    body: "<p>Mỗi khung thời gian kể một câu chuyện khác nhau. Khung nhỏ (5m, 15m) cho thấy sóng ngắn; khung lớn (4h, 1d) cho thấy dòng chảy chính.</p><p><b>Cách đọc:</b> Khi tất cả các khung cùng một chiều, tín hiệu đáng tin hơn. Khi khung nhỏ ngược khung lớn, thường chỉ là nhịp hồi.</p><p><b>Ví dụ:</b> 1d và 4h đang tăng, 15m đang giảm → có thể là nhịp chỉnh để tìm điểm mua, chứ không phải lúc bán khống.</p>"
  },

  // ───────────── Biến động ─────────────
  {
    id: "atr",
    group: "Biến động",
    term: "ATR %",
    short: "Biên độ dao động trung bình của 14 nến gần nhất, tính theo phần trăm giá.",
    body: "<p>ATR (Average True Range) đo trung bình mỗi nến giá dao động bao nhiêu từ thấp đến cao (có tính cả khoảng nhảy giữa hai nến). ATR % là ATR chia cho giá.</p><p><b>Ví dụ:</b> BTC 62.000, ATR khung 1h là 620 USDT → ATR% = 1%. Nghĩa là mỗi giờ giá thường dao động khoảng 1%.</p><p><b>Dùng để làm gì:</b> Đặt stop loss quá gần (ví dụ 0,3% khi ATR 1%) thì rất dễ bị quét chỉ do dao động bình thường.</p>"
  },
  {
    id: "realized-vol",
    group: "Biến động",
    term: "Biến động thực tế (năm hoá)",
    short: "Mức dao động giá đã thực sự xảy ra, quy về một năm; 60% nghĩa là khoảng ±3,1% mỗi ngày.",
    body: "<p>Biến động thực tế đo giá đã thực sự lên xuống mạnh cỡ nào trong thời gian gần đây, sau đó quy đổi ra con số theo năm để dễ so sánh.</p><p><b>Cách đọc:</b> Chia cho √365 (khoảng 19,1) để ra mức dao động điển hình một ngày.</p><p><b>Ví dụ:</b> Biến động 60% → 60 / 19,1 ≈ 3,1%/ngày. Với BTC 62.000, một ngày bình thường giá hay dao động khoảng ±1.900 USDT.</p><p><b>Lưu ý:</b> Đây là “dao động điển hình”, có những ngày dao động gấp 2–3 lần.</p>"
  },
  {
    id: "vol-regime",
    group: "Biến động",
    term: "Chế độ biến động",
    short: "So biến động hiện tại với lịch sử của chính mã đó: Nén (dưới 25%), Bình thường, hoặc Bùng nổ (trên 80%).",
    body: "<ul><li><b>Nén</b> (dưới 25% lịch sử): giá đang đi rất hẹp. Thị trường thường “nén lò xo” trước một cú bùng nổ, nhưng không biết sẽ bùng lên hay xuống.</li><li><b>Bình thường:</b> dao động ở mức thông thường.</li><li><b>Bùng nổ</b> (trên 80% lịch sử): giá đang chạy rất mạnh, rủi ro cao, nên giảm khối lượng.</li></ul><p><b>Con số % trong ngoặc:</b> vị trí so với lịch sử của chính mã đó. “Nén (12%)” nghĩa là chỉ 12% thời gian trong lịch sử có biến động thấp hơn bây giờ.</p>"
  },
  {
    id: "dvol",
    group: "Biến động",
    term: "DVOL (Deribit)",
    short: "Mức biến động mà thị trường quyền chọn kỳ vọng cho BTC/ETH trong 30 ngày tới, quy về năm.",
    body: "<p>DVOL được tính từ giá quyền chọn trên sàn Deribit. Quyền chọn đắt khi người ta lo giá sẽ chạy mạnh, nên DVOL phản ánh mức “sợ hãi” hoặc “kỳ vọng biến động”.</p><p><b>Cách đọc:</b> DVOL 50 ≈ thị trường kỳ vọng giá dao động khoảng ±50%/năm, tức khoảng ±2,6% mỗi ngày (50 ÷ √365).</p><ul><li><b>Thay đổi 24h:</b> DVOL tăng nhanh = thị trường đang lo lắng hơn.</li><li><b>Vị trí 30 ngày:</b> DVOL hiện tại nằm cao hay thấp so với 30 ngày qua.</li><li><b>Chênh lệch kỳ vọng − thực tế:</b> dương = quyền chọn đắt, thị trường lo sợ hơn mức dao động thật; âm = quyền chọn rẻ, thị trường đang chủ quan.</li></ul><p><b>Ví dụ:</b> DVOL 55, biến động thực tế 40 → chênh +15: thị trường đang chờ một sự kiện lớn.</p>"
  },

  // ───────────── Hồ sơ khối lượng ─────────────
  {
    id: "volume-profile",
    group: "Hồ sơ khối lượng",
    term: "Hồ sơ khối lượng (Volume Profile)",
    short: "Biểu đồ thanh ngang cho biết đã khớp bao nhiêu khối lượng ở mỗi mức giá trong một khoảng thời gian.",
    body: "<p>Khác với khối lượng theo thời gian (cột dưới nến), hồ sơ khối lượng xếp khối lượng theo <b>giá</b>. Thanh ngang càng dài = ở mức giá đó đã giao dịch càng nhiều.</p><p><b>Cách đọc:</b> Vùng thanh dài là nơi thị trường “chấp nhận” giá, giá hay chậm lại ở đó. Vùng thanh ngắn là nơi giá đi qua nhanh.</p><p><b>Ví dụ:</b> Trong tuần qua, BTC giao dịch nhiều nhất ở 61.000–61.500 → đây là vùng cân bằng của tuần.</p>"
  },
  {
    id: "poc",
    group: "Hồ sơ khối lượng",
    term: "POC (Point of Control)",
    short: "Mức giá có khối lượng giao dịch lớn nhất trong cả khoảng thời gian đang xem — “giá công bằng” của thị trường.",
    body: "<p>POC là thanh dài nhất trên hồ sơ khối lượng.</p><p><b>Cách đọc:</b> Giá thường bị hút về POC khi đi ngang, và POC hay làm hỗ trợ/kháng cự.</p><p><b>Ví dụ:</b> POC tuần là 61.300. Giá đang 62.800 và bắt đầu yếu đi → có khả năng quay về thử lại quanh 61.300.</p>"
  },
  {
    id: "value-area",
    group: "Hồ sơ khối lượng",
    term: "Vùng giá trị (Value Area 70%)",
    short: "Khoảng giá quanh POC chứa 70% tổng khối lượng giao dịch; VAH là cạnh trên, VAL là cạnh dưới.",
    body: "<p>Bắt đầu từ POC, mở rộng lên xuống cho đến khi gom được 70% tổng khối lượng. Cạnh trên gọi là VAH, cạnh dưới là VAL.</p><p><b>Cách đọc:</b> Giá trong vùng giá trị = thị trường cân bằng. Giá ra ngoài vùng và đứng được = thị trường đang tìm mức giá mới. Giá ra ngoài rồi quay lại vào trong thường chạy về phía cạnh bên kia.</p><p><b>Ví dụ:</b> VAL 60.800, POC 61.300, VAH 61.900. Giá lên 62.100 rồi rơi lại dưới 61.900 → hay quay về 60.800.</p>"
  },
  {
    id: "hvn",
    group: "Hồ sơ khối lượng",
    term: "HVN (nút khối lượng cao)",
    short: "Mức giá có khối lượng cao hơn hẳn xung quanh; giá thường chậm lại và đi ngang ở đây.",
    body: "<p>HVN (High Volume Node) là “ngọn núi” trên hồ sơ khối lượng — nơi nhiều người đã đồng ý giao dịch.</p><p><b>Cách đọc:</b> Giá đi vào HVN thường bị chậm lại, giằng co. HVN hay đóng vai trò hỗ trợ/kháng cự.</p><p><b>Ví dụ:</b> HVN ở 2.420 của ETH: giá giảm đến đó thường đi ngang một lúc trước khi chọn hướng.</p>"
  },
  {
    id: "lvn",
    group: "Hồ sơ khối lượng",
    term: "LVN (nút khối lượng thấp)",
    short: "Mức giá có rất ít khối lượng; giá thường lướt nhanh qua đây như đi qua “khoảng trống”.",
    body: "<p>LVN (Low Volume Node) là “thung lũng” trên hồ sơ khối lượng — nơi giá từng đi qua rất nhanh, ít ai giao dịch.</p><p><b>Cách đọc:</b> Khi giá đi vào LVN, nó thường chạy nhanh sang HVN kế tiếp. LVN cũng hay là ranh giới giữa hai vùng cân bằng.</p><p><b>Ví dụ:</b> LVN ở 61.700 nằm giữa hai HVN 61.300 và 62.200. Giá phá 61.700 có thể chạy thẳng lên 62.200.</p>"
  },
  {
    id: "vwap",
    group: "Backtest",
    term: "VWAP (giá trung bình theo khối lượng)",
    short: "Giá trung bình có tính đến khối lượng, cho biết trung bình người giao dịch đang mua/bán ở giá nào.",
    body: "<p>VWAP (Volume Weighted Average Price) là giá trung bình của tất cả giao dịch, mức giá nào khớp nhiều thì được tính nặng hơn.</p><p><b>Cách đọc:</b> Giá trên VWAP = trung bình người mua đang có lãi, phe mua kiểm soát. Giá dưới VWAP = phe bán kiểm soát. Các quỹ lớn hay dùng VWAP làm chuẩn để mua/bán.</p><p><b>Ví dụ:</b> VWAP ngày của BTC là 61.850, giá hiện tại 62.300 → trong ngày, phe mua đang chiếm ưu thế.</p><p><b>Các loại:</b> VWAP ngày (tính lại từ 0h UTC mỗi ngày), VWAP tuần (từ đầu tuần), VWAP cuộn (tính trên một số nến gần nhất, không reset).</p>"
  },

  // ───────────── Backtest ─────────────
  {
    id: "backtest",
    group: "Backtest",
    term: "Backtest (kiểm thử trên quá khứ)",
    short: "Chạy thử một chiến lược trên dữ liệu quá khứ để xem nó đã lời hay lỗ ra sao trước khi dùng tiền thật.",
    body: "<p>Backtest giả lập: “nếu tôi đã giao dịch theo quy tắc này trong 6 tháng qua thì kết quả thế nào?”.</p><p><b>Vì sao cần:</b> Giúp loại bỏ những ý tưởng nghe hay nhưng thực ra thua lỗ, mà không mất tiền thật.</p><p><b>Không nhìn trước tương lai:</b> Khi tín hiệu xuất hiện ở nến đóng cửa, lệnh được vào ở <b>giá mở của nến kế tiếp</b>. Như vậy backtest không dùng thông tin mà lúc đó bạn chưa thể biết.</p><p><b>Lưu ý:</b> Quá khứ không đảm bảo tương lai. Backtest tốt là điều kiện cần, không phải điều kiện đủ.</p>"
  },
  {
    id: "bt-net",
    group: "Backtest",
    term: "Lợi nhuận ròng",
    short: "Tiền lãi hoặc lỗ cuối cùng sau khi đã trừ phí giao dịch và trượt giá.",
    body: "<p>Lợi nhuận ròng = tổng lãi − tổng lỗ − phí − trượt giá. Đây là con số bạn thực sự nhận được.</p><p><b>Ví dụ:</b> Vốn 1.000 USDT, cuối kỳ còn 1.180 USDT → lợi nhuận ròng +180 USDT (+18%).</p><p><b>Lưu ý:</b> Chiến lược giao dịch quá nhiều lần có thể có lãi trước phí nhưng lỗ sau phí.</p>"
  },
  {
    id: "bt-trades",
    group: "Backtest",
    term: "Số lệnh (L/S)",
    short: "Tổng số lệnh đã vào, tách theo lệnh long (L) và short (S).",
    body: "<p>Cho biết chiến lược đã giao dịch bao nhiêu lần và nghiêng về phe nào.</p><p><b>Ví dụ:</b> “42 (L 30 / S 12)” = 42 lệnh, 30 lệnh long và 12 lệnh short.</p><p><b>Lưu ý:</b> Dưới khoảng 30 lệnh thì kết quả chưa đủ tin cậy về mặt thống kê — có thể chỉ là may mắn.</p>"
  },
  {
    id: "bt-winrate",
    group: "Backtest",
    term: "Tỷ lệ thắng",
    short: "Phần trăm số lệnh có lãi; tỷ lệ thắng thấp vẫn có thể có lãi nếu mỗi lần lời lớn hơn nhiều so với mỗi lần lỗ.",
    body: "<p>Tỷ lệ thắng = số lệnh lãi ÷ tổng số lệnh.</p><p><b>Ví dụ:</b> Thắng 35% nhưng mỗi lần thắng được 3R, mỗi lần thua mất 1R. Trong 100 lệnh: 35 × 3 − 65 × 1 = +40R → vẫn có lãi tốt.</p><p><b>Lưu ý:</b> Tỷ lệ thắng 80% nhưng thắng ít thua nhiều vẫn có thể cháy tài khoản.</p>"
  },
  {
    id: "bt-pf",
    group: "Backtest",
    term: "Profit Factor (hệ số lợi nhuận)",
    short: "Tổng tiền lãi chia tổng tiền lỗ; lớn hơn 1 là có lãi, trên 1,5 là tốt.",
    body: "<p>Profit factor = tổng lãi của các lệnh thắng ÷ tổng lỗ của các lệnh thua.</p><p><b>Cách đọc:</b> &lt; 1: thua lỗ. 1–1,3: lãi mỏng, dễ mất lãi khi điều kiện thực tế xấu hơn. &gt; 1,5: tốt. &gt; 3: rất tốt, nhưng nên nghi ngờ quá khớp.</p><p><b>Ví dụ:</b> Tổng lãi 900 USDT, tổng lỗ 500 USDT → PF = 1,8.</p>"
  },
  {
    id: "bt-avgr",
    group: "Backtest",
    term: "R trung bình",
    short: "Lãi/lỗ trung bình mỗi lệnh tính theo đơn vị R, với 1R là số tiền bạn chấp nhận mất nếu dính stop loss.",
    body: "<p><b>R là gì:</b> 1R = số tiền rủi ro mỗi lệnh (khoảng cách tới stop loss × khối lượng). Tính theo R giúp so sánh các lệnh với nhau dù kích thước khác nhau.</p><p><b>Ví dụ:</b> Rủi ro mỗi lệnh 10 USDT. Lệnh lãi 25 USDT = +2,5R; lệnh dính stop = −1R. R trung bình +0,3 nghĩa là mỗi lệnh trung bình kiếm được 0,3 × 10 = 3 USDT.</p>"
  },
  {
    id: "bt-expectancy",
    group: "Backtest",
    term: "Kỳ vọng mỗi lệnh",
    short: "Trung bình mỗi lệnh mang lại bao nhiêu USDT, đã tính cả lệnh thắng và lệnh thua.",
    body: "<p>Kỳ vọng = lợi nhuận ròng ÷ số lệnh. Đây là “mỗi lần bấm nút trung bình được bao nhiêu tiền”.</p><p><b>Ví dụ:</b> 50 lệnh, lợi nhuận ròng 200 USDT → kỳ vọng +4 USDT/lệnh.</p><p><b>Lưu ý:</b> Kỳ vọng dương nhưng rất nhỏ thì chỉ cần phí hoặc trượt giá cao hơn một chút là mất lãi.</p>"
  },
  {
    id: "bt-mdd",
    group: "Backtest",
    term: "Sụt giảm tối đa (Max Drawdown)",
    short: "Mức vốn bị giảm sâu nhất tính từ một đỉnh vốn trước đó — cho biết bạn phải chịu đựng cảm giác lỗ tệ nhất cỡ nào.",
    body: "<p>Max drawdown đo khoảng sụt lớn nhất từ đỉnh vốn xuống đáy vốn tiếp theo.</p><p><b>Ví dụ:</b> Vốn lên 1.300 USDT rồi rớt xuống 1.040 USDT trước khi hồi phục → sụt giảm tối đa = 260 / 1.300 = 20%.</p><p><b>Lưu ý:</b> Sụt 50% thì cần lãi 100% mới về lại vốn cũ. Hãy chắc rằng bạn chịu được con số này về tâm lý; thực tế thường còn tệ hơn backtest.</p>"
  },
  {
    id: "bt-sharpe",
    group: "Backtest",
    term: "Sharpe (năm hoá)",
    short: "Lợi nhuận so với độ lắc lư của vốn; trên 1 là khá, trên 2 là tốt, âm là tệ.",
    body: "<p>Sharpe đo xem để có được lợi nhuận, đường vốn phải lên xuống thất thường đến đâu. Cùng lãi 20%, chiến lược đi lên đều đặn có Sharpe cao hơn chiến lược lên xuống thất thường.</p><p><b>Cách đọc:</b> &lt; 0: lỗ. 0–1: tạm. &gt; 1: khá. &gt; 2: tốt. &gt; 3 trên backtest: nên nghi ngờ quá khớp.</p>"
  },
  {
    id: "bt-avgbars",
    group: "Backtest",
    term: "Giữ lệnh trung bình",
    short: "Trung bình mỗi lệnh được giữ bao nhiêu nến trước khi thoát.",
    body: "<p>Cho biết chiến lược là lướt nhanh hay giữ lâu.</p><p><b>Ví dụ:</b> Khung 15 phút, giữ trung bình 12 nến = khoảng 3 giờ mỗi lệnh.</p><p><b>Lưu ý:</b> Giữ lâu trên futures thì phải trả thêm phí funding (không tính trong backtest nếu không ghi rõ).</p>"
  },
  {
    id: "bt-exposure",
    group: "Backtest",
    term: "Thời gian có vị thế",
    short: "Phần trăm thời gian trong kỳ backtest mà bạn đang giữ một lệnh mở.",
    body: "<p>Exposure = tổng thời gian có lệnh ÷ tổng thời gian kiểm thử.</p><p><b>Ví dụ:</b> Exposure 25% nghĩa là 3/4 thời gian bạn đứng ngoài, vốn không chịu rủi ro.</p><p><b>Cách đọc:</b> Lãi bằng nhau mà exposure thấp hơn thì tốt hơn, vì ít thời gian phơi mình trước rủi ro.</p>"
  },
  {
    id: "bt-risk",
    group: "Backtest",
    term: "Rủi ro mỗi lệnh %",
    short: "Phần trăm vốn bạn chấp nhận mất nếu một lệnh dính stop loss; khối lượng lệnh được tính theo con số này.",
    body: "<p>Ứng dụng tính khối lượng sao cho nếu giá chạm stop loss, bạn mất đúng số % vốn này.</p><p><b>Ví dụ:</b> Vốn 1.000 USDT, rủi ro 1% = mất tối đa 10 USDT mỗi lệnh. Stop cách giá vào 2% → khối lượng lệnh = 10 / 2% = 500 USDT.</p><p><b>Lưu ý:</b> Người giao dịch lâu năm thường để 0,5–2%. Trên 5% thì vài lệnh thua liên tiếp đã đủ làm vốn sụt nặng.</p>"
  },
  {
    id: "bt-leverage",
    group: "Backtest",
    term: "Đòn bẩy tối đa",
    short: "Giới hạn trên của đòn bẩy; nếu khối lượng tính theo rủi ro cần đòn bẩy cao hơn thì lệnh bị thu nhỏ lại.",
    body: "<p>Khi stop loss rất gần, công thức rủi ro có thể đòi một khối lượng lớn hơn vốn nhiều lần. Đòn bẩy tối đa chặn điều đó lại.</p><p><b>Ví dụ:</b> Vốn 1.000, rủi ro 10 USDT, stop cách 0,2% → cần 5.000 USDT = 5x. Nếu giới hạn là 3x thì lệnh chỉ còn 3.000 USDT, rủi ro thực tế còn 6 USDT.</p>"
  },
  {
    id: "bt-fee",
    group: "Backtest",
    term: "Phí taker",
    short: "Phí sàn thu khi bạn khớp lệnh market (ăn lệnh chờ); backtest tính phí này cho cả lúc vào và lúc ra.",
    body: "<p>Taker là người khớp ngay bằng lệnh market, thường phải trả phí cao hơn maker (người đặt lệnh chờ).</p><p><b>Ví dụ:</b> Phí 0,05% mỗi chiều, lệnh 1.000 USDT → vào 0,5 + ra 0,5 = 1 USDT mỗi lệnh. 200 lệnh mỗi tháng là 200 USDT tiền phí.</p>"
  },
  {
    id: "bt-slippage",
    group: "Backtest",
    term: "Trượt giá (bps)",
    short: "Khoảng chênh giữa giá bạn muốn và giá thực sự khớp; 1 bps = 0,01%.",
    body: "<p>Khi đặt lệnh market, bạn thường khớp ở giá tệ hơn một chút so với giá trên màn hình, nhất là lúc thị trường chạy nhanh.</p><p><b>Đơn vị bps:</b> 1 bps (basis point) = 0,01%. 5 bps = 0,05%.</p><p><b>Ví dụ:</b> Mua BTC ở 62.000 với trượt giá 5 bps → giá khớp thực tế ≈ 62.031.</p><p><b>Lưu ý:</b> Với coin ít thanh khoản, nên để trượt giá cao hơn (10–30 bps) cho sát thực tế.</p>"
  },
  {
    id: "bt-rr",
    group: "Backtest",
    term: "Tỉ lệ lời/lỗ (R)",
    short: "Mục tiêu chốt lời đặt cách giá vào bao nhiêu lần khoảng cách stop loss; ví dụ 2R là lời gấp đôi rủi ro.",
    body: "<p>Take profit được đặt ở khoảng cách = R × khoảng cách stop loss.</p><p><b>Ví dụ:</b> Vào long 62.000, stop 61.500 (rủi ro 500). Tỉ lệ 2R → take profit ở 63.000.</p><p><b>Lưu ý:</b> R càng cao thì mỗi lần thắng càng lời nhiều nhưng tỷ lệ thắng thường giảm.</p>"
  },
  {
    id: "bt-maxhold",
    group: "Backtest",
    term: "Giữ tối đa",
    short: "Số nến tối đa một lệnh được giữ; quá giới hạn mà chưa chạm TP hay SL thì lệnh tự đóng.",
    body: "<p>Giúp tránh giữ lệnh “treo” quá lâu khi ý tưởng ban đầu không còn đúng.</p><p><b>Ví dụ:</b> Giữ tối đa 48 nến trên khung 15 phút = 12 giờ. Sau 12 giờ lệnh được đóng ở giá thị trường, ghi lý do “Hết giờ”.</p>"
  },
  {
    id: "bt-reason",
    group: "Backtest",
    term: "Lý do thoát lệnh",
    short: "Vì sao lệnh được đóng: TP (chốt lời), SL (cắt lỗ), Hết giờ (quá thời gian giữ) hoặc Cuối dữ liệu.",
    body: "<ul><li><b>TP:</b> giá chạm mục tiêu chốt lời.</li><li><b>SL:</b> giá chạm stop loss.</li><li><b>Hết giờ:</b> giữ quá số nến tối đa.</li><li><b>Cuối dữ liệu:</b> backtest hết dữ liệu khi lệnh còn mở, lệnh được đóng ở giá cuối cùng.</li></ul><p><b>Lưu ý:</b> Nếu trong cùng một nến giá chạm cả TP lẫn SL, backtest giả định chạm SL trước cho an toàn.</p>"
  },
  {
    id: "bt-overfit",
    group: "Backtest",
    term: "Cảnh báo quá khớp",
    short: "Chỉnh tham số cho thật đẹp trên dữ liệu quá khứ không đảm bảo chiến lược sẽ lãi trong tương lai.",
    body: "<p>Quá khớp (overfitting) là khi bạn thử đi thử lại các thông số đến khi kết quả quá khứ đẹp, nhưng thực chất là “học thuộc” các biến động ngẫu nhiên đã xảy ra.</p><p><b>Dấu hiệu:</b> Chỉ cần đổi tham số một chút (ví dụ 20 thành 22) là kết quả sụp đổ; số lệnh quá ít; profit factor hoặc Sharpe cao bất thường.</p><p><b>Cách phòng:</b> Thử trên nhiều coin và nhiều giai đoạn khác nhau; ưu tiên các tham số mà xung quanh nó kết quả cũng tốt; bắt đầu tiền thật với khối lượng nhỏ.</p>"
  },
  {
    id: "strat-volbreakout",
    group: "Backtest",
    term: "Chiến lược phá vỡ khối lượng",
    short: "Vào lệnh khi giá phá ra khỏi vùng đi ngang kèm khối lượng tăng vọt, theo hướng phá vỡ.",
    body: "<p>Ý tưởng: cú phá vỡ thật thường có nhiều người tham gia, nên khối lượng tăng mạnh. Phá vỡ với khối lượng thấp hay là bẫy.</p><p><b>Quy tắc chung:</b> Nến đóng cửa vượt đỉnh (hoặc đáy) gần nhất và có khối lượng cao bất thường (tính theo σ) → vào theo hướng phá ở giá mở nến sau; stop loss đặt ở phía bên kia vùng hoặc theo ATR.</p><p><b>Ví dụ:</b> BTC đi ngang 61.000–62.000, nến 1h đóng 62.300 với khối lượng 3σ → vào long ở giá mở nến kế tiếp.</p><p><b>Lưu ý:</b> Hiệu quả trong thị trường có xu hướng; trong thị trường đi ngang sẽ có nhiều lần phá vỡ giả.</p>"
  },
  {
    id: "strat-srretest",
    group: "Backtest",
    term: "Chiến lược test lại hỗ trợ / kháng cự",
    short: "Chờ giá quay về một mức hỗ trợ/kháng cự mạnh và bị đẩy lại rồi mới vào lệnh theo hướng bật.",
    body: "<p>Ý tưởng: mức hỗ trợ/kháng cự có độ mạnh cao hay khiến giá phản ứng. Thay vì đuổi theo giá, ta chờ giá về mức và có dấu hiệu bật lại.</p><p><b>Quy tắc chung:</b> Giá chạm mức HT (hoặc KC) nhưng nến đóng cửa vẫn ở phía đúng của mức → vào long (hoặc short) ở giá mở nến sau; stop loss ngay bên kia mức.</p><p><b>Ví dụ:</b> HT 60.000 độ mạnh 80. Nến 15m xuống 59.950 nhưng đóng ở 60.150 → vào long, stop 59.700.</p><p><b>Lưu ý:</b> Mức nào cũng có lúc bị phá; luôn dùng stop loss.</p>"
  },
  {
    id: "strat-vwap",
    group: "Backtest",
    term: "Chiến lược VWAP",
    short: "Dùng VWAP (ngày, tuần hoặc cuộn) làm hỗ trợ/kháng cự động, giao dịch khi giá bật lại hoặc xuyên qua VWAP.",
    body: "<p>VWAP là mức giá trung bình mà nhiều quỹ dùng làm chuẩn, nên giá hay phản ứng khi chạm VWAP.</p><p><b>Chọn loại VWAP:</b> VWAP ngày (reset mỗi ngày), VWAP tuần (reset mỗi tuần), VWAP cuộn (tính trên N nến gần nhất).</p><p><b>Hai kiểu vào lệnh:</b></p><ul><li><b>Bật lại:</b> giá chạm VWAP rồi bị đẩy ngược lại → vào theo hướng bật (VWAP đóng vai hỗ trợ/kháng cự).</li><li><b>Xuyên qua:</b> nến đóng cửa xuyên hẳn qua VWAP → vào theo hướng xuyên (phe kia vừa giành quyền kiểm soát).</li></ul><p><b>Bảng thống kê:</b> cho biết trong quá khứ, khi giá chạm VWAP thì bao nhiêu % lần bật lại và bao nhiêu % lần xuyên qua, giúp chọn kiểu nào hợp với mã đang xem.</p><p><b>Ví dụ:</b> Bảng cho thấy BTC khung 15m bật lại ở VWAP ngày 62% số lần → kiểu “bật lại” đáng thử hơn.</p>"
  }
  ,
  // ───────────── Order flow nâng cao ─────────────
  {
    id: "smart-dom", group: "Order flow nâng cao", term: "Smart DOM (sổ lệnh thông minh)",
    short: "Sổ lệnh bậc thang có thêm các cột phân tích: khối lượng hôm nay, thay đổi độ sâu, đã khớp, footprint nến, bản đồ thanh khoản.",
    body: "<p>DOM thường chỉ cho thấy lệnh chờ mua/bán ở mỗi giá. Smart DOM ghép thêm các cột để thấy <b>thanh khoản đang di chuyển ra sao</b> và <b>ai đang khớp lệnh ở đâu</b>.</p><ul><li><b>Hôm nay:</b> khối lượng khớp trong ngày tại mỗi giá, giống hồ sơ khối lượng thu nhỏ.</li><li><b>Δ Mua / Δ Bán:</b> lệnh chờ tăng hay giảm trong 5 giây.</li><li><b>Bán / Mua:</b> khối lượng chủ động đã khớp tại giá.</li><li><b>Bản đồ 60s:</b> Bookmap thu nhỏ của 60 giây gần nhất kèm dấu vết giá.</li><li><b>FP nến:</b> footprint của nến đang chạy.</li></ul><p>Bấm <b>Cột ▾</b> để bật/tắt từng cột cho đúng việc bạn đang làm.</p>"
  },
  {
    id: "depth-change", group: "Order flow nâng cao", term: "Thay đổi độ sâu (Δ Mua / Δ Bán)",
    short: "Lệnh chờ tại một giá tăng hay giảm bao nhiêu trong 5 giây qua: cho biết thanh khoản đang được thêm vào hay rút đi.",
    body: "<p>So sánh lệnh chờ hiện tại với 5 giây trước ở từng mức giá.</p><p><b>Cách đọc:</b></p><ul><li>Số <b>+</b> lớn ở phía mua dưới giá: có người đang đặt thêm lệnh đỡ giá.</li><li>Số <b>−</b> lớn mà cột Bán/Mua không tăng tương ứng: lệnh bị <b>rút</b>, không phải bị khớp. Thường là tường giả (spoofing).</li><li>Số <b>−</b> đi kèm khối lượng khớp lớn: tường đang bị ăn thật.</li></ul>"
  },
  {
    id: "dom-liqmap", group: "Order flow nâng cao", term: "Bản đồ thanh khoản và dấu vết trong DOM",
    short: "Bookmap thu nhỏ 60 giây ngay trong sổ lệnh: màu sáng là lệnh chờ dày, đường trắng là dấu vết giá, chấm là lệnh khớp.",
    body: "<p>Cột <b>Bản đồ 60s</b> vẽ lịch sử sổ lệnh 60 giây gần nhất cho đúng các dòng giá của DOM, bên phải là hiện tại.</p><ul><li>Dải sáng kéo dài: tường thanh khoản đứng yên lâu, đáng tin hơn.</li><li>Dải sáng xuất hiện rồi biến mất khi giá tới gần: lệnh bị rút.</li><li><b>Dấu vết</b> (đường trắng): đường đi của giá trong 60 giây.</li><li>Chấm xanh/đỏ: lệnh gốc mua/bán chủ động; viền trắng là lệnh lớn.</li></ul>"
  },
  {
    id: "smart-tape", group: "Order flow nâng cao", term: "Smart Tape (băng lệnh thông minh)",
    short: "Băng lệnh khớp đã ghép các lệnh nhỏ cùng thời điểm, cùng phía thành lệnh gốc, để thấy đúng kích thước lệnh của tổ chức.",
    body: "<p>Khi một quỹ mua 1.000 hợp đồng bằng lệnh market, lệnh đó ăn qua nhiều lệnh chờ và sàn báo thành hàng trăm lệnh khớp nhỏ cùng một thời điểm. Băng thường trông như một chuỗi số nhỏ lộn xộn.</p><p><b>Smart Tape</b> ghép các lệnh khớp liền nhau cùng phía, cùng thời điểm thành <b>một lệnh gốc</b>.</p><p><b>Các cột:</b> Thời gian · Giá · +/− (số mức giá đã ăn qua) · KL (khối lượng gốc) · Bid/Ask (giá tốt nhất ngay trước khi khớp) · Sizes (khối lượng chờ ở bid × ask lúc đó) · TB (khối lượng trung bình mỗi lệnh nhỏ).</p><p>Dòng tô màu đậm là lệnh lớn (top 0,5%). Tắt <b>Ghép lệnh</b> để xem băng thô của sàn.</p>"
  },
  {
    id: "sweep", group: "Order flow nâng cao", term: "Quét giá (+/−)",
    short: "Số mức giá một lệnh gốc đã ăn qua. Nhiều dấu + hoặc − nghĩa là lệnh rất hung hăng, chấp nhận trượt giá để khớp ngay.",
    body: "<p>Một lệnh market lớn hơn lượng chờ ở giá tốt nhất sẽ ăn tiếp sang giá kế bên. Cột +/− cho biết nó đã ăn qua bao nhiêu mức.</p><p><b>Ví dụ:</b> <b>+++++</b> = lệnh mua ăn qua 5 mức giá; <b>−12</b> = lệnh bán ăn qua 12 mức giá. Nhiều lệnh quét liên tiếp cùng phía thường là dấu hiệu phe đó đang rất gấp.</p>"
  },
  {
    id: "absorption", group: "Order flow nâng cao", term: "Hấp thụ (Absorption)",
    short: "Lực chủ động rất lớn ở một đầu nến nhưng giá không đi tiếp: lệnh chờ phía đối diện đã ăn hết. Chấm đỏ ở đáy = bán bị hấp thụ.",
    body: "<p>Trang đánh dấu một nến là <b>hấp thụ bán</b> (chấm đỏ dưới đáy) khi đủ cả ba điều kiện:</p><ul><li>Khối lượng nến cao bất thường (từ 2σ so với 50 nến trước).</li><li>Ở 1/3 dưới của nến, bán chủ động chiếm ít nhất 30% khối lượng cả nến và 60% giao dịch ở vùng đó.</li><li>Giá vẫn đóng cửa ở nửa trên của nến: bán rất mạnh nhưng giá không xuống được.</li></ul><p>Nghĩa là lệnh chờ mua đã đỡ hết lực bán, phe mua đang thắng thế. <b>Hấp thụ mua</b> (chấm xanh trên đỉnh) là ngược lại.</p><p>Chấm càng to thì càng mạnh. Rê chuột lên chấm để xem số liệu và kết quả sau đó (giá có đảo chiều được 1 ATR trước khi phá đáy/đỉnh không). Bảng <b>Hấp thụ</b> ở dưới thống kê tỷ lệ đúng trên dữ liệu đang xem.</p><p><b>Lưu ý:</b> tín hiệu chỉ dùng dữ liệu tới hết nến đó. Với nến có footprint ước tính, điều kiện chặt hơn và kém chính xác hơn footprint thật.</p>"
  },
  {
    id: "big-trades", group: "Order flow nâng cao", term: "Big Trades",
    short: "Các lệnh gốc lớn nhất (top 0,5% sau khi ghép) vẽ thành vòng tròn trên biểu đồ nến và footprint, tại giá trung bình của lệnh.",
    body: "<p>Lấy từ Smart Tape: mỗi vòng tròn là một lệnh gốc lớn. Xanh = mua chủ động, đỏ = bán chủ động, vòng càng to lệnh càng lớn.</p><p>Với Binance, trang tải lại lệnh khớp thật của các nến gần nhất nên có cả Big Trades trong quá khứ gần; các sàn khác chỉ có từ lúc mở trang.</p><p><b>Cách đọc:</b> nhiều Big Trades bán ở đáy mà giá không giảm thêm thường đi cùng hấp thụ; Big Trades mua phá qua kháng cự là dấu hiệu phá vỡ có lực.</p>"
  },
  {
    id: "cluster-search", group: "Order flow nâng cao", term: "Cluster Search (tìm cụm khối lượng)",
    short: "Tự tìm các ô footprint (một mức giá trong một nến) có khối lượng hoặc delta lớn bất thường và đóng khung cam.",
    body: "<p>Chọn <b>Tìm cụm ▾</b> trên biểu đồ:</p><ul><li><b>Đo theo:</b> tổng khối lượng, delta (|mua − bán|), chỉ mua hoặc chỉ bán chủ động.</li><li><b>Ngưỡng:</b> top 0,1% đến 2% ô lớn nhất, hoặc nhập một số tối thiểu.</li></ul><p>Các ô này thường là nơi phe lớn vào lệnh. Khi giá quay lại vùng đó, nó hay đóng vai trò hỗ trợ/kháng cự. Danh sách nằm ở tab <b>Cụm khối lượng</b> phía dưới.</p>"
  },
  {
    id: "cvd-pro", group: "Order flow nâng cao", term: "Delta, CVD và CVD Pro",
    short: "Delta: mua − bán từng nến. CVD: delta cộng dồn (đường). CVD Pro: CVD vẽ thành nến và bắt đầu lại mỗi ngày.",
    body: "<p>Chọn ở ô <b>Ô dưới</b> của biểu đồ:</p><ul><li><b>Delta:</b> cột xanh/đỏ, mua chủ động trừ bán chủ động trong từng nến.</li><li><b>CVD:</b> đường cộng dồn delta, kèm open interest.</li><li><b>CVD Pro:</b> CVD vẽ thành nến (mở = CVD đầu nến, đóng = cuối nến, râu = đỉnh/đáy CVD trong nến nếu theo dõi được), bắt đầu lại từ 0 mỗi ngày (UTC) để so các phiên với nhau.</li></ul><p><b>Phân kỳ:</b> giá làm đỉnh mới nhưng nến CVD Pro không lên được đỉnh mới nghĩa là lực mua chủ động đang yếu đi.</p>"
  },
  {
    id: "range-profile", group: "Order flow nâng cao", term: "Hồ sơ khối lượng cho vùng tự chọn",
    short: "Bấm Chọn vùng (hoặc giữ Shift) rồi kéo trên biểu đồ để xem POC, vùng giá trị 70% và HVN/LVN của đúng đoạn đó.",
    body: "<p>Dùng khi muốn xem một đoạn giá cụ thể (ví dụ một vùng đi ngang, một đợt tăng) đã giao dịch nhiều nhất ở đâu.</p><ul><li><b>POC</b> (vàng): giá khớp nhiều nhất trong đoạn.</li><li><b>VAH/VAL</b> (tím, nét đứt): cạnh trên/dưới của vùng chứa 70% khối lượng, kéo dài sang phải để làm hỗ trợ/kháng cự.</li></ul><p>Có footprint thì tính theo từng mức giá thật; không có thì chia đều khối lượng trên biên độ nến. Chuột phải vào vùng để xoá. Bật <b>Hồ sơ từng ngày</b> trong Lớp hiển thị để tự vẽ cho mỗi ngày.</p>"
  }

];

export const GROUPS = ["Order flow nâng cao", "Bookmap", "Footprint", "Dòng lệnh", "Thanh lý", "Hỗ trợ / kháng cự", "Xu hướng & động lượng", "Biến động", "Hồ sơ khối lượng", "Backtest"];
