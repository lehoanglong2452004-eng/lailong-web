// © 2026 Lai Long Desk. Bảo lưu mọi quyền. Không sao chép, chỉnh sửa hay dùng lại khi chưa được phép.
// Từ điển giải thích thuật ngữ hiển thị trong ngăn "Giải thích" và chú thích khi rê chuột.
export const GLOSSARY = [
  // ───────────── Bookmap ─────────────
  {
    id: "bm-settings",
    group: "Bookmap",
    term: "Cài đặt Bookmap",
    short: "Chỉnh màu bản đồ, bong bóng, các đường và các cột bên phải. Lưu trên máy của bạn, nhấp đúp vào ô để về mặc định.",
    body: "<p>Bảng cài đặt chia bốn phần: <b>màu bản đồ</b>, <b>bong bóng khối lượng</b>, <b>đường trên bản đồ</b> và <b>cột bên phải</b>. Mọi thay đổi được lưu trên trình duyệt của bạn, mở lại trang vẫn giữ.</p><p>Nhấp đúp vào một ô để đưa ô đó về mặc định.</p>"
  },
  {
    id: "bm-colors",
    group: "Bookmap",
    term: "Bảng màu",
    short: "Bookmap: xanh đen, xanh nhạt, vàng, cam, đỏ (đỏ là dày nhất). Xám: đen tới trắng.",
    body: "<p>Màu càng nóng thì lệnh chờ ở mức giá đó càng dày. Bảng xám giúp nhìn bong bóng và đường giá rõ hơn khi bản đồ quá rực.</p>"
  },
  {
    id: "bm-cutoff",
    group: "Bookmap",
    term: "Ngưỡng cắt trên / dưới",
    short: "Lệnh chờ từ phân vị cắt trên trở lên tô màu đậm nhất; dưới phân vị cắt dưới để nền tối.",
    body: "<p>Các mức lệnh chờ đang thấy được xếp từ nhỏ tới lớn. <b>Cắt trên 99%</b> nghĩa là 1% mức dày nhất cùng tô màu đỏ đậm nhất, phần còn lại trải đều trên bảng màu. <b>Cắt dưới 2%</b> nghĩa là 2% mức mỏng nhất để nền tối, đỡ rối mắt.</p><p>Hạ cắt trên (ví dụ 95%) thì nhiều tường hiện đỏ hơn; tăng cắt dưới (ví dụ 20%) thì chỉ còn chỗ dày nổi lên.</p>"
  },
  {
    id: "bm-auto",
    group: "Bookmap",
    term: "Tự chỉnh tương phản",
    short: "Liên tục: tính lại ngưỡng màu mỗi lần vẽ. Khi căn giữa lại: chỉ tính lại khi giá chạy ra mép hoặc khi phóng to/thu nhỏ. Giữ nguyên: khoá ngưỡng, chỉ tính lại khi phóng to / thu nhỏ hoặc đổi chế độ.",
    body: "<p>Giữ nguyên giúp so màu giữa các thời điểm (cùng một màu là cùng một lượng lệnh chờ). Liên tục giúp bản đồ luôn rõ nhưng màu có thể đổi khi có tường lớn xuất hiện.</p>"
  },
  {
    id: "bm-smooth",
    group: "Bookmap",
    term: "Làm mịn dọc",
    short: "Làm mịn bản đồ theo chiều giá. Tự động chỉ làm khi thu nhỏ nhiều (nhiều mức giá trong một điểm ảnh).",
    body: "<p>Khi thu nhỏ, mỗi điểm ảnh chứa nhiều mức giá nên bản đồ dễ bị lốm đốm. Làm mịn lấy trung bình với các điểm ảnh trên dưới để thấy vùng thanh khoản rõ hơn. Khi phóng to sát, nên tắt để thấy từng mức giá.</p>"
  },
  {
    id: "bm-dim",
    group: "Bookmap",
    term: "Làm tối bản đồ",
    short: "Giảm độ sáng bản đồ để bong bóng, đường giá và nến nổi lên.",
    body: "<p>Giảm độ sáng bản đồ để bong bóng, đường giá và nến nổi lên.</p>"
  },
  {
    id: "bm-aggregate",
    group: "Bookmap",
    term: "Sổ lệnh cộng dồn trên bản đồ",
    short: "Mỗi mức giá tô theo tổng lệnh chờ từ giá hiện tại tới mức đó, thay vì riêng mức đó.",
    body: "<p>Cho biết giá phải ăn hết bao nhiêu lệnh chờ để đi tới một mức. Càng xa giá càng sáng, nên chỗ màu tăng vọt là nơi có tường.</p>"
  },
  {
    id: "bm-cluster",
    group: "Bookmap",
    term: "Gom bong bóng",
    short: "Cách gộp lệnh khớp thành một bong bóng: thông minh, theo thời gian, theo khối lượng hoặc theo giá.",
    body: "<ul><li><b>Thông minh:</b> mỗi nhóm điểm ảnh một bong bóng, rồi gộp các quả chồng lên nhau nhiều. Mặc định.</li><li><b>Theo thời gian:</b> mỗi N giây một bong bóng, không phụ thuộc phóng to.</li><li><b>Theo khối lượng:</b> mỗi bong bóng đủ một lượng khớp (0 là tự động: khoảng 1/120 tổng khối lượng trên màn hình). Bong bóng đều cỡ, dày đặc khi thị trường sôi động.</li><li><b>Theo giá:</b> gộp tới khi giá khớp đổi sang mức khác.</li></ul><p>Bong bóng đặt ở giá trung bình đã khớp và thời điểm trung bình của nhóm.</p>"
  },
  {
    id: "bm-dotmode",
    group: "Bookmap",
    term: "Bong bóng theo tổng hay delta",
    short: "Tổng: cỡ theo tổng khối lượng khớp. Delta: cỡ theo chênh lệch mua chủ động trừ bán chủ động, màu theo phe thắng.",
    body: "<p>Tổng: cỡ theo tổng khối lượng khớp. Delta: cỡ theo chênh lệch mua chủ động trừ bán chủ động, màu theo phe thắng.</p>"
  },
  {
    id: "bm-dotmin",
    group: "Bookmap",
    term: "Ẩn bong bóng nhỏ",
    short: "Chỉ vẽ bong bóng có khối lượng (hoặc delta) từ mức này trở lên. 0 là hiện tất cả.",
    body: "<p>Chỉ vẽ bong bóng có khối lượng (hoặc delta) từ mức này trở lên. 0 là hiện tất cả.</p>"
  },
  {
    id: "bm-bbo",
    group: "Bookmap",
    term: "Đường giá mua / bán và giá khớp cuối",
    short: "Đường bậc thang xanh là giá mua tốt nhất, đỏ là giá bán tốt nhất, trắng mảnh là giá khớp cuối.",
    body: "<p>Khi thu nhỏ tới mức hai đường xanh đỏ gần nhau dưới ngưỡng điểm ảnh đã chọn, chúng tự ẩn và chỉ còn đường giá khớp cuối cho đỡ rối. Chúng hiện lại khi khoảng cách rộng hơn ngưỡng 20%, để khỏi nhấp nháy.</p>"
  },
  {
    id: "bm-vwap",
    group: "Bookmap",
    term: "VWAP phiên",
    short: "Giá trung bình theo khối lượng của mọi lệnh khớp kể từ lúc mở trang (đường tím).",
    body: "<p>Giá trên VWAP: phe mua đang lời trung bình. Dưới VWAP: phe bán chiếm ưu thế. VWAP thường là nơi giá quay về.</p>"
  },
  {
    id: "bm-poc",
    group: "Bookmap",
    term: "Đường POC",
    short: "POC là giá khớp nhiều nhất. Đường vàng liền là POC của vùng đang xem, cam nét đứt là POC cả phiên.",
    body: "<p>Đường chỉ hiện khi cột Volume Profile tương ứng đang bật.</p>"
  },
  {
    id: "bm-candles",
    group: "Bookmap",
    term: "Nến trên Bookmap",
    short: "Vẽ nến của khung đang chọn (1m, 5m...) chồng lên bản đồ, thân rỗng để vẫn thấy thanh khoản phía sau.",
    body: "<p>Vẽ nến của khung đang chọn (1m, 5m...) chồng lên bản đồ, thân rỗng để vẫn thấy thanh khoản phía sau.</p>"
  },
  {
    id: "bm-slices",
    group: "Bookmap",
    term: "Vạch chia thời gian",
    short: "Kẻ vạch chấm dọc mỗi N giây hoặc phút để dễ đếm thời gian trên bản đồ.",
    body: "<p>Kẻ vạch chấm dọc mỗi N giây hoặc phút để dễ đếm thời gian trên bản đồ.</p>"
  },
  {
    id: "bm-recenter",
    group: "Bookmap",
    term: "Tự căn giữa",
    short: "Khi đang theo dõi, bản đồ tự dời lên xuống khi giá chạy ra gần mép. Chọn theo giá mua/bán, theo giá khớp cuối, hoặc tắt.",
    body: "<p>Khi đang theo dõi, bản đồ tự dời lên xuống khi giá chạy ra gần mép. Chọn theo giá mua/bán, theo giá khớp cuối, hoặc tắt.</p>"
  },
  {
    id: "bm-cob",
    group: "Bookmap",
    term: "Cột COB (sổ lệnh hiện tại)",
    short: "Thanh và con số lệnh chờ ở từng dòng giá ngay lúc này: đỏ là chờ bán, xanh là chờ mua. Có thể kèm sổ lệnh cộng dồn và hiện theo %.",
    body: "<p>COB đi cùng dòng giá với bản đồ. Dòng tô nền là giá mua / bán tốt nhất. Khi thu nhỏ, vài mức giá được gộp chung một dòng để chữ không chồng nhau.</p><p>Chế độ % cho biết mỗi dòng chiếm bao nhiêu phần trăm tổng lệnh chờ đang thấy.</p>"
  },
  {
    id: "bm-vp",
    group: "Bookmap",
    term: "Volume Profile vùng / phiên",
    short: "Khối lượng đã khớp ở từng dòng giá. Vùng: trong khoảng thời gian trên màn hình. Phiên: từ lúc mở trang.",
    body: "<p>Phần xanh là mua chủ động, đỏ là bán chủ động. Viền vàng là POC. Giá hay bị hút về POC và hay đi nhanh qua chỗ ít khối lượng.</p>"
  },
  {
    id: "bm-qd",
    group: "Bookmap",
    term: "Cột +/− lệnh chờ",
    short: "Lệnh chờ được thêm vào (xanh, số dương) hay rút ra hoặc bị khớp (đỏ, số âm) ở mỗi dòng giá, đặt lại mỗi khi giá tốt nhất đổi.",
    body: "<p>Dùng để bắt người lớn đang dựng hay rút tường ngay trước mặt giá. Ví dụ giá đi lên mà các dòng phía trên liên tục âm: bên bán đang rút lệnh, đường lên dễ hơn.</p>"
  },
  {
    id: "bm-tc",
    group: "Bookmap",
    term: "Cột đếm số lệnh khớp",
    short: "Số lệnh khớp ở mỗi dòng giá trong khoảng thời gian đang xem.",
    body: "<p>Nhiều lệnh mà khối lượng nhỏ thường là thuật toán hoặc đám đông nhỏ lẻ; ít lệnh mà khối lượng lớn thường là tay to.</p>"
  },
  {
    id: "bookmap",
    group: "Bookmap",
    term: "Bookmap (bản đồ nhiệt sổ lệnh)",
    short: "Hình ảnh sổ lệnh theo thời gian: màu càng sáng ở mức giá nào thì càng nhiều lệnh chờ ở đó.",
    body: "<p>Bookmap vẽ lại sổ lệnh (các lệnh mua/bán đang chờ khớp) theo thời gian. Trục ngang là thời gian, trục dọc là giá. Mỗi điểm màu cho biết tại thời điểm đó, ở mức giá đó có bao nhiêu lệnh đang chờ.</p><p><b>Cách đọc:</b></p><ul><li>Màu xanh đậm = rất ít lệnh chờ.</li><li>Xanh nhạt, vàng, cam, đỏ = càng lúc càng nhiều lệnh chờ. Đỏ là dày nhất, thường gọi là “tường thanh khoản”.</li><li>Đường bậc thang xanh lá = giá mua tốt nhất (bid), đỏ = giá bán tốt nhất (ask). Nét đứt bên phải là giá mua / bán đang đứng.</li><li><b>Bong bóng 3D</b> = khối lượng đã khớp. Thể tích quả cầu tỷ lệ với khối lượng; phần xanh là mua chủ động, phần đỏ là bán chủ động.</li><li><b>Cột sổ lệnh bên phải</b> (COB): thanh và con số lệnh chờ ở từng dòng giá, cạnh đó là sổ lệnh cộng dồn.</li><li><b>Mốc giá</b>: mở cửa ngày, đỉnh / đáy hôm nay và hôm qua (giờ UTC), cùng hỗ trợ / kháng cự, có nhãn ở trục giá.</li><li>Hai thanh nhỏ góc trên: lệch sổ lệnh và lệch khối lượng khớp giữa mua và bán.</li></ul><p><b>Ví dụ:</b> BTC đang ở 62.300 USDT, bạn thấy một dải vàng sáng kéo dài ngang ở 62.000. Nghĩa là ở 62.000 có nhiều người đặt lệnh mua chờ, giá đi xuống đó dễ bị chặn lại.</p><p><b>Lưu ý:</b> Lệnh chờ có thể bị huỷ bất cứ lúc nào, nên dải sáng không đảm bảo giá sẽ dừng ở đó.</p>"
  },
  {
    id: "liquidity-wall",
    group: "Bookmap",
    term: "Tường thanh khoản",
    short: "Một mức giá có lượng lệnh chờ lớn bất thường, có thể chặn giá lại — nhưng cũng có thể bị rút đi (spoofing).",
    body: "<p>Tường thanh khoản là một mức giá có rất nhiều lệnh chờ mua hoặc chờ bán so với các mức xung quanh. Trên Bookmap nó hiện thành một dải ngang màu vàng, cam hoặc đỏ.</p><p><b>Cách đọc:</b> Tường dưới giá (lệnh chờ mua) có thể làm “đệm đỡ”; tường trên giá (lệnh chờ bán) có thể làm “trần”. Nếu giá chạm tường và tường bị ăn dần (dải nhạt đi trong khi có nhiều bong bóng khớp), tường có thể sắp bị phá.</p><p><b>Ví dụ:</b> ETH ở 2.450, có tường bán 3.000 ETH ở 2.480. Giá lên 2.478 rồi quay đầu nhiều lần — tường đang giữ.</p><p><b>Lưu ý (spoofing):</b> Có người đặt tường lớn để doạ thị trường rồi rút ngay khi giá đến gần. Nếu dải sáng biến mất đột ngột mà không có lệnh khớp, đó là tường giả.</p>"
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
    short: "Số giờ tối đa một lệnh được giữ; quá giới hạn mà chưa chạm TP hay SL thì lệnh tự đóng.",
    body: "<p>Giúp tránh giữ lệnh “treo” quá lâu khi ý tưởng ban đầu không còn đúng. Mặc định 48 giờ, đúng giới hạn bạn không giữ lệnh quá 2 phiên ngày.</p><p><b>Ví dụ:</b> Giữ tối đa 48 giờ trên khung 15 phút = 192 nến. Sau 48 giờ lệnh được đóng ở giá đóng cửa, ghi lý do “Hết giờ”.</p>"
  },
  {
    id: "bt-reason",
    group: "Backtest",
    term: "Lý do thoát lệnh",
    short: "Vì sao lệnh được đóng: Chốt lời, Cắt lỗ, Hết giờ, Cuối ngày (MIDOTI) hoặc Cuối dữ liệu.",
    body: "<ul><li><b>Chốt lời:</b> giá chạm TP1 hoặc TP2.</li><li><b>Cắt lỗ:</b> giá chạm stop loss.</li><li><b>Cuối ngày:</b> MIDOTI đóng lệnh trước mốc OP ngày mới.</li><li><b>Hết giờ:</b> giữ quá số nến tối đa.</li><li><b>Cuối dữ liệu:</b> backtest hết dữ liệu khi lệnh còn mở, lệnh được đóng ở giá cuối cùng.</li></ul><p><b>Lưu ý:</b> Nếu trong cùng một nến giá chạm cả TP lẫn SL, backtest giả định chạm SL trước cho an toàn.</p>"
  },
  {
    id: "bt-overfit",
    group: "Backtest",
    term: "Cảnh báo quá khớp",
    short: "Chỉnh tham số cho thật đẹp trên dữ liệu quá khứ không đảm bảo chiến lược sẽ lãi trong tương lai.",
    body: "<p>Quá khớp (overfitting) là khi bạn thử đi thử lại các thông số đến khi kết quả quá khứ đẹp, nhưng thực chất là “học thuộc” các biến động ngẫu nhiên đã xảy ra.</p><p><b>Dấu hiệu:</b> Chỉ cần đổi tham số một chút (ví dụ 20 thành 22) là kết quả sụp đổ; số lệnh quá ít; profit factor hoặc Sharpe cao bất thường.</p><p><b>Cách phòng:</b> Thử trên nhiều coin và nhiều giai đoạn khác nhau; ưu tiên các tham số mà xung quanh nó kết quả cũng tốt; bắt đầu tiền thật với khối lượng nhỏ.</p>"
  },
  {
    id: "bt-strategies",
    group: "Backtest",
    term: "13 chiến lược backtest",
    short: "Bộ chiến lược thuần giá và khối lượng của Lai Long, mỗi chiến lược có luật vào lệnh và cắt lỗ rõ ràng để máy kiểm chứng.",
    body: "<p>Mỗi chiến lược chỉ nhìn các nến đã đóng cửa (không nhìn trước tương lai). Khi đủ điều kiện, nó báo lệnh MUA hoặc BÁN kèm giá cắt lỗ đặt theo cấu trúc (dưới đáy, ngoài vùng, ngoài râu nến...).</p><p><b>Danh sách:</b> MIDOTI v2.568, hai đỉnh/hai đáy, Fibonacci 0.5–0.68, pinbar/engulfing volume lớn, pullback EMA, pullback VWAP, orderblock, 31 mẫu hình khối lượng (gom 8 nhóm), Point of Entry (QML), Supply Demand Zone, Wyckoff, cấu trúc HH-HL / LH-LL, chống lại thị trường.</p><p><b>Lưu ý:</b> Máy chỉ làm được phần có quy tắc rõ ràng. Phần cảm nhận bằng mắt (vùng “đẹp”, tin tức) không đưa vào được, nên kết quả là cận dưới của một trader giỏi dùng cùng chiến lược.</p>"
  },
  {
    id: "bt-pin",
    group: "Backtest",
    term: "Ghim chiến lược (⭐)",
    short: "Bấm ngôi sao để ghim chiến lược yêu thích lên đầu danh sách. Lưu trên trình duyệt của máy này.",
    body: "<p>Chiến lược đã ghim hiện ở nhóm đầu danh sách và có ⭐ trong bảng xếp hạng. Bấm lại ngôi sao để bỏ ghim.</p><p><b>Lưu ý:</b> Danh sách ghim lưu trong trình duyệt, đổi máy hoặc xoá dữ liệu trình duyệt thì phải ghim lại.</p>"
  },
  {
    id: "bt-tp",
    group: "Backtest",
    term: "TP1 và TP2 (hai kịch bản chốt lời)",
    short: "Mỗi lệnh được tính hai lần: chốt hết ở TP1, hoặc giữ tới TP2. Cùng một SL, không dời SL.",
    body: "<p>Giống bảng thống kê của MIDOTI: mỗi lệnh có hai “chân” độc lập dùng chung giá vào và SL.</p><ul><li><b>TP1:</b> chốt toàn bộ khi giá chạm TP1 (mặc định 1R).</li><li><b>TP2:</b> giữ tới TP2 (mặc định 2R). Chạm TP1 rồi quay về SL vẫn tính thua −1R.</li></ul><p>Lệnh chỉ kết thúc khi cả hai chân đã đóng, nên hai kịch bản có cùng số lệnh và so sánh công bằng. Nút <b>Kết quả theo TP1 / TP2</b> đổi kịch bản đang xem.</p><p><b>Ví dụ:</b> Vào long 100, SL 99 (1R = 1). TP1 = 101, TP2 = 102. Giá lên 101.5 rồi rơi về 99: chân TP1 +1R, chân TP2 −1R.</p>"
  },
  {
    id: "bt-entry",
    group: "Backtest",
    term: "Cách vào lệnh ở vùng",
    short: "Lệnh chờ ở mép vùng (như trong tài liệu) hoặc chờ nến xác nhận đóng cửa rồi mới vào.",
    body: "<ul><li><b>Lệnh chờ ở mép vùng:</b> giá vừa chạm mép gần của vùng tươi là khớp. Giá tốt hơn, SL ngắn hơn, nhưng hay bị quét SL khi vùng không giữ.</li><li><b>Chờ nến xác nhận:</b> nến chạm vùng phải đóng cửa quay ra theo hướng vùng (nến tăng ở vùng cầu, nến giảm ở vùng cung) mới vào ở giá đóng cửa. Ít lệnh thua hơn nhưng giá vào kém hơn.</li></ul><p>Vùng chỉ dùng một lần: lần chạm đầu tiên làm vùng hết “tươi”, dù có vào lệnh hay không.</p>"
  },
  {
    id: "bt-volmult",
    group: "Backtest",
    term: "Volume ≥ × trung bình",
    short: "Khối lượng nến phải lớn hơn bao nhiêu lần khối lượng trung bình của 20 nến trước đó.",
    body: "<p>Ví dụ 2 nghĩa là nến có khối lượng ít nhất gấp đôi trung bình 20 nến trước nó (không tính chính nó).</p><p><b>Lưu ý:</b> Ngưỡng càng cao thì càng ít lệnh nhưng mỗi tín hiệu càng “đặc biệt”. Dưới 30 lệnh thì kết quả chưa đáng tin.</p>"
  },
  {
    id: "bt-scen",
    group: "Backtest",
    term: "Ba kịch bản: cả hai phía, LONG, SHORT",
    short: "Cùng chiến lược nhưng lấy cả hai phía, chỉ lệnh MUA hoặc chỉ lệnh BÁN, để biết phía nào thật sự có lợi thế.",
    body: "<p>Mỗi kịch bản là một lần chạy riêng: “Chỉ LONG” bỏ qua mọi tín hiệu BÁN nên có thể vào được những lệnh mua mà bản cả hai phía bỏ lỡ (vì lúc đó đang giữ lệnh bán).</p><ul><li><b>WR:</b> tỷ lệ lệnh có lãi sau phí.</li><li><b>PF:</b> tổng R thắng / tổng R thua. Trên 1 là có lãi.</li><li><b>Tổng R:</b> cộng dồn R của mọi lệnh.</li><li><b>Vốn:</b> lãi kép với mức rủi ro mỗi lệnh đã chọn.</li><li><b>Kỳ vọng / lệnh (95%):</b> R trung bình mỗi lệnh và khoảng tin cậy 95%. Cận dưới trên 0 với ít nhất 30 lệnh mới gọi là có lợi thế.</li><li><b>Sụt giảm tối đa:</b> từ đỉnh cao nhất của đường vốn xuống đáy sau đó.</li></ul><p>Kịch bản nào nằm dưới đường 0 thì không giao dịch còn tốt hơn. Vạch đứt trên biểu đồ là mốc chia 70% dữ liệu đầu và 30% cuối.</p>"
  },
  {
    id: "bt-oos",
    group: "Backtest",
    term: "Kiểm chứng ngoài mẫu (70% / 30%)",
    short: "So kết quả trên 70% dữ liệu đầu với 30% dữ liệu cuối. Lợi thế thật phải còn ở phần cuối.",
    body: "<p>Nếu bạn chỉnh thông số cho đẹp, hãy coi 70% đầu là nơi chỉnh, 30% cuối là “bài thi” chưa từng thấy.</p><p><b>Cách đọc:</b> phần cuối vẫn có kỳ vọng R dương thì lợi thế còn giữ. Phần đầu đẹp mà phần cuối âm thường là quá khớp hoặc thị trường đã đổi tính chất.</p><p><b>Lưu ý:</b> phần cuối ít lệnh hơn nên khoảng tin cậy rộng hơn.</p>"
  },
  {
    id: "bt-rank",
    group: "Backtest",
    term: "Bảng xếp hạng chiến lược",
    short: "Chạy cả 13 chiến lược với thông số mặc định trên cùng mã, khung và số nến, rồi xếp theo cận dưới kỳ vọng R.",
    body: "<p>Xếp theo cận dưới khoảng tin cậy 95% của kỳ vọng R mỗi lệnh, tức là kịch bản xấu mà vẫn hợp lý. Cách này phạt chiến lược ít lệnh, vì ít lệnh thì khoảng tin cậy rộng.</p><p>Bấm vào một dòng để mở chiến lược đó và xem chi tiết.</p><p><b>Lưu ý:</b> Chạy 13 chiến lược rồi chọn cái tốt nhất cũng là một kiểu chọn lọc may rủi. Hãy xem thêm cột “30% cuối” và thử trên mã khác trước khi tin.</p>"
  },
  {
    id: "bt-robust",
    group: "Backtest",
    term: "Kiểm tra độ bền",
    short: "Chạy cùng một chiến lược, cùng thông số trên nhiều coin, chia nhiều đoạn thời gian và tách theo trạng thái thị trường.",
    body: "<p>Một kết quả đẹp trên một coin, một giai đoạn có thể chỉ là may mắn. Lợi thế thật phải còn khi đổi coin, đổi thời gian và đổi tính chất thị trường.</p><p><b>Ba điều kiện để gọi là bền:</b></p><ul><li>Gộp mọi lệnh của mọi coin: có ít nhất 30 lệnh và cận dưới khoảng tin cậy 95% của kỳ vọng R trên 0.</li><li>Ít nhất 2/3 số coin có kỳ vọng dương.</li><li>Ít nhất 2/3 số đoạn thời gian có kỳ vọng dương.</li></ul><p>Coin hoặc đoạn có dưới 5 lệnh không được tính vào hai điều kiện sau vì quá ít để nói lên điều gì.</p><p>Gõ tên coin cách nhau bằng dấu phẩy, tối đa 12 coin. Coin nào sàn không có sẽ được bỏ qua và báo lại.</p><p><b>Lưu ý:</b> thông số phải đặt trước rồi mới chạy. Chỉnh đi chỉnh lại cho tới khi bảng này đẹp thì nó không còn là bài thử nữa.</p>"
  },
  {
    id: "bt-segs",
    group: "Backtest",
    term: "Chia nhiều đoạn thời gian (walk-forward)",
    short: "Chia toàn bộ thời gian thành các đoạn liên tiếp dài bằng nhau, xem chiến lược có kiếm tiền ở từng đoạn không.",
    body: "<p>Thay vì chỉ chia 70/30 một lần, thời gian được chia thành nhiều đoạn (mặc định 5). Mỗi lệnh thuộc đoạn chứa lúc vào lệnh.</p><p>Vì thông số được đặt trước và giữ nguyên cho mọi đoạn, mỗi đoạn là một lần thử độc lập. Chiến lược bền thì phần lớn các ô có màu xanh, không chỉ một hai đoạn lời đậm còn lại lỗ.</p><p><b>Cách đọc ô:</b> số trên là kỳ vọng R mỗi lệnh, số dưới là số lệnh. Ô mờ là dưới 5 lệnh, chưa đáng tin.</p>"
  },
  {
    id: "bt-regime",
    group: "Backtest",
    term: "Trạng thái thị trường: lên, xuống, đi ngang",
    short: "Tách kết quả theo lúc có tín hiệu thị trường đang có xu hướng lên, xu hướng xuống hay đi ngang.",
    body: "<p>Tại nến có tín hiệu, xét 50 nến trước đó (không nhìn trước). Tỷ lệ hiệu quả = quãng giá đi được từ đầu tới cuối chia cho tổng quãng đường giá đã chạy.</p><ul><li>Từ 0,3 trở lên và giá tăng: <b>thị trường lên</b>.</li><li>Từ 0,3 trở lên và giá giảm: <b>thị trường xuống</b>.</li><li>Dưới 0,3: <b>đi ngang</b>, giá chạy qua lại nhiều mà không đi được xa.</li></ul><p>Nhờ bảng này bro biết chiến lược hợp lúc nào, ví dụ chỉ dùng khi thị trường đi ngang và tắt khi có xu hướng mạnh.</p>"
  },
  {
    id: "bt-reset",
    group: "Backtest",
    term: "Nhấp đúp để về mặc định",
    short: "Mọi ô thông số đều gõ được số tuỳ ý. Nhấp đúp vào ô để trả về giá trị mặc định.",
    body: "<p>Áp dụng cho trang Backtest và FRACTAL. Ô có giới hạn nhỏ nhất và lớn nhất, gõ vượt quá thì máy tự kéo về trong giới hạn khi chạy.</p>"
  }
  ,
  // ───────────── Order flow nâng cao ─────────────
  {
    id: "smart-dom", group: "Order flow nâng cao", term: "Smart DOM (sổ lệnh thông minh)",
    short: "Sổ lệnh bậc thang có thêm các cột phân tích: khối lượng hôm nay, thay đổi độ sâu, đã khớp, footprint nến, bản đồ thanh khoản.",
    body: "<p>DOM thường chỉ cho thấy lệnh chờ mua/bán ở mỗi giá. Smart DOM ghép thêm các cột để thấy <b>thanh khoản đang di chuyển ra sao</b> và <b>ai đang khớp lệnh ở đâu</b>.</p><ul><li><b>Hôm nay:</b> khối lượng khớp trong ngày tại mỗi giá, giống hồ sơ khối lượng thu nhỏ.</li><li><b>Δ Mua / Δ Bán:</b> lệnh chờ tăng hay giảm trong 5 giây.</li><li><b>Bán / Mua:</b> khối lượng chủ động đã khớp tại giá.</li><li><b>FP nến:</b> footprint của nến đang chạy.</li><li><b>Tường:</b> tường lệnh chờ lớn và số lần bị rút.</li></ul><p>Bấm <b>Cột ▾</b> để bật/tắt từng cột cho đúng việc bạn đang làm. Bản đồ thanh khoản nằm ở khung riêng ngay bên trái, cùng dòng giá với DOM.</p>"
  },
  {
    id: "depth-change", group: "Order flow nâng cao", term: "Thay đổi độ sâu (Δ Mua / Δ Bán)",
    short: "Lệnh chờ tại một giá tăng hay giảm bao nhiêu trong 5 giây qua: cho biết thanh khoản đang được thêm vào hay rút đi.",
    body: "<p>So sánh lệnh chờ hiện tại với 5 giây trước ở từng mức giá.</p><p><b>Cách đọc:</b></p><ul><li>Số <b>+</b> lớn ở phía mua dưới giá: có người đang đặt thêm lệnh đỡ giá.</li><li>Số <b>−</b> lớn mà cột Bán/Mua không tăng tương ứng: lệnh bị <b>rút</b>, không phải bị khớp. Thường là tường giả (spoofing).</li><li>Số <b>−</b> đi kèm khối lượng khớp lớn: tường đang bị ăn thật.</li></ul>"
  },
  {
    id: "dom-liqmap", group: "Order flow nâng cao", term: "Bản đồ thanh khoản (khung cạnh sổ lệnh)",
    short: "Bookmap thu nhỏ đặt giữa biểu đồ giá và sổ lệnh: mỗi dòng trùng một dòng giá của DOM, màu sáng là lệnh chờ dày, đường trắng là dấu vết giá.",
    body: "<p>Khung <b>Bản đồ thanh khoản</b> vẽ lịch sử sổ lệnh 30 giây đến 15 phút gần nhất (chọn ở đầu khung), bên phải là bây giờ. Mỗi dòng trùng đúng một dòng giá của Smart DOM bên cạnh nên đọc ngang là thấy giá.</p><ul><li>Dải sáng kéo dài: tường thanh khoản đứng yên lâu, đáng tin hơn. Khung vàng là tường đang đứng.</li><li>Dải sáng biến mất khi giá tới gần: lệnh bị rút; dấu × cam là nghi tường giả.</li><li><b>Dấu vết</b> (đường trắng): giá giữa; đường xanh/đỏ mảnh là giá mua/bán tốt nhất.</li><li>Bong bóng xanh/đỏ: lệnh gốc mua/bán chủ động; viền trắng là lệnh lớn.</li></ul><p>Kéo đường chia bên trái để đổi độ rộng, bấm ✕ để ẩn (bật lại trong <b>Lớp hiển thị</b>). Lăn chuột trên khung để cuộn giá cùng sổ lệnh.</p>"
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
  },
  {
    id: "ofi", group: "Order flow nâng cao", term: "OFI (Order Flow Imbalance, áp lực sổ lệnh)",
    short: "Đo bên nào đang dồn lệnh chờ ở giá tốt nhất: dương là bên mua kéo giá mua lên, âm là bên bán ép xuống. Chọn trong ô \"Ô dưới\".",
    body: "<p>Mỗi lần sổ lệnh thay đổi: nếu giá mua tốt nhất tăng hoặc lệnh chờ mua ở đó dày thêm thì cộng; nếu giá bán tốt nhất giảm hoặc lệnh chờ bán dày thêm thì trừ (phương pháp của Cont, Kukanov và Stoikov). Cộng trong mỗi nến thành một cột, cộng dồn thành đường vàng.</p><p><b>Cách đọc:</b> delta cho biết ai <i>khớp lệnh</i> chủ động, OFI cho biết ai đang <i>đặt lệnh chờ</i>. Giá tăng mà OFI âm dần là phe mua đang yếu đi trong sổ lệnh.</p><p><b>Giới hạn:</b> sàn không cho tải lịch sử sổ lệnh nên OFI chỉ có từ lúc mở trang.</p>"
  },
  {
    id: "vpin", group: "Order flow nâng cao", term: "VPIN (dòng lệnh \"độc\")",
    short: "Mức một chiều của dòng lệnh, 0 là mua bán cân bằng, gần 1 là một phía áp đảo. VPIN cao thường đi trước những cú chạy mạnh.",
    body: "<p>Chia khối lượng thành các giỏ bằng nhau (1/50 khối lượng một ngày), mỗi giỏ tính |mua − bán| chia khối lượng giỏ, rồi lấy trung bình 50 giỏ gần nhất (Easley, López de Prado, O'Hara).</p><p><b>Vì sao quan trọng:</b> khi một phía biết điều gì đó hoặc phải mua/bán gấp, bên tạo lập thị trường bị thua liên tục nên rút lệnh chờ, thanh khoản mỏng đi và giá dễ chạy mạnh. Vạch nét đứt đỏ là mức top 10% của chính mã đó; vùng tô đỏ là lúc dòng lệnh \"độc\".</p><p>VPIN không cho biết hướng, chỉ cho biết sắp có biến động. Kết hợp với delta hoặc hấp thụ để biết phía nào.</p>"
  },
  {
    id: "player-groups", group: "Order flow nâng cao", term: "Nhóm người chơi (cá voi / vừa / nhỏ lẻ)",
    short: "Lệnh gốc được chia theo kích thước: cá voi là top 0,5%, vừa là top 5%, còn lại là nhỏ lẻ. Xem delta từng nhóm ở ô dưới và lọc trên Smart Tape.",
    body: "<p>Ngưỡng tính theo chính mã đang xem (lệnh 1 BTC là nhỏ với BTC nhưng rất lớn với một đồng nhỏ). Ô dưới \"Delta theo nhóm người chơi\" vẽ CVD của từng nhóm trên cùng một thang.</p><p><b>Cách đọc:</b> cá voi mua ròng trong khi nhỏ lẻ bán ròng là dấu hiệu tích luỹ; ngược lại là phân phối. Cột \"Nhóm\" trên Smart Tape ghi \"Máy\" cho lệnh thuộc một chuỗi chia đều.</p><p>Binance tải lại được lệnh khớp cũ nên có số liệu cho nhiều nến; sàn khác chỉ có từ lúc mở trang.</p>"
  },
  {
    id: "wall-journal", group: "Order flow nâng cao", term: "Nhật ký tường",
    short: "Khung ghi lại mọi tường lệnh chờ lớn quanh giá: xuất hiện ở đâu, cỡ bao nhiêu, đứng bao lâu, kết cục ra sao và giá đi thế nào 1 phút, 5 phút sau đó. Thống kê cho biết phe nào hay dựng tường giả.",
    body: "<p><b>Nhật ký</b>: mỗi dòng là một tường đã mất. Cột Sau 1′ và Sau 5′ là giá thay đổi bao nhiêu % kể từ lúc tường mất.</p><p><b>Thống kê</b>: <i>tỷ lệ rút khi giá tới gần</i> là trong các tường bị giá chạm tới, bao nhiêu phần trăm bị rút ngay trước khi bị ăn. Tỷ lệ cao ở phía mua nghĩa là tường đỡ giá phần lớn là giả. Bảng phản ứng giá tính theo hướng tường bảo vệ: tường mua thì giá lên là dương, tường bán thì giá xuống là dương. Tường bị ăn mà con số dương là tường hấp thụ xong giá bật lại; âm là giá phá tường và chạy tiếp.</p><p><b>Đang đứng</b>: các tường trong ±1% quanh giá ngay lúc này.</p><p>Số liệu tính từ lúc mở trang cho mã đang xem; cần vài chục lần mỗi loại thì mới đáng tin.</p>",
  },
  {
    id: "book-imb", group: "Bookmap", term: "Mất cân bằng sổ lệnh gần giá",
    short: "Đường tím ở ô dưới Bookmap: (lệnh chờ mua − lệnh chờ bán) / tổng, chỉ tính trong ±0,5% quanh giá, mỗi cột một điểm. Trên vạch giữa là chờ mua dày hơn.",
    body: "<p>Đọc cùng CVD (đường vàng): CVD tăng mà sổ nghiêng về bán là người mua đang chủ động ăn vào tường bán, nếu tường không rút mà giá vẫn đứng là bên bán đang hấp thụ. CVD giảm mà sổ nghiêng về mua là có bên đang đỡ giá. Sổ lệnh đổi chiều đột ngột ngay trước một cú chạy thường là tường bị rút.</p><p>Lưu ý: lệnh chờ có thể bị rút bất cứ lúc nào, nên đây là thứ để đọc cùng dòng lệnh đã khớp, không phải tín hiệu riêng.</p>",
  },
  {
    id: "telegram", group: "Công cụ", term: "Cảnh báo qua Telegram",
    short: "Gửi mọi cảnh báo đang bật sang Telegram của bro. Cần mã bot và chat id; cả hai chỉ lưu trên máy này.",
    body: "<p><b>Cách lấy</b>: trong Telegram nhắn cho @BotFather lệnh /newbot để tạo bot và nhận mã bot. Nhắn cho bot vừa tạo một tin bất kỳ, rồi nhắn cho @userinfobot để biết chat id của mình. Dán hai thứ đó vào menu Cảnh báo và bấm Gửi thử.</p><p>Trang phải đang mở thì mới gửi được cảnh báo.</p>",
  },
  {
    id: "spoofing", group: "Order flow nâng cao", term: "Tường giả (spoofing)",
    short: "Lệnh chờ rất lớn dựng lên để doạ phe kia rồi rút đi khi giá tới gần. Bộ theo dõi đếm số lần tường bị rút mà gần như không được khớp.",
    body: "<p>Mỗi giây hệ thống tìm \"tường\": mức giá có lệnh chờ ≥ 6 lần trung vị và thuộc top 3% trong ±1% quanh giá. Khi tường mất ≥ 75% khối lượng:</p><ul><li><b>Bị ăn</b> (tường thật): khối lượng khớp tại đó ≥ một nửa phần mất.</li><li><b>Rút khi giá tới gần</b> (nghi tường giả): khớp rất ít và giá đã tới sát.</li><li><b>Rút khi giá còn xa</b>: đổi ý bình thường.</li></ul><p>Trên Smart DOM, cột <b>Tường</b> tô vàng tường đang đứng và ghi \"G×n\" (giả) màu cam. Trên biểu đồ, dấu × cam là chỗ tường bị rút. Một mức giá có nhiều lần \"giả\" thì đừng coi tường ở đó là hỗ trợ/kháng cự thật.</p>"
  },
  {
    id: "iceberg", group: "Order flow nâng cao", term: "Lệnh băng chìm (iceberg)",
    short: "Một mức giá bị khớp nhiều hơn hẳn lượng đang hiện trên sổ lệnh mà vẫn đứng: có người giấu lệnh lớn hoặc liên tục nạp lại.",
    body: "<p>Ở mỗi mức giá đang bị khớp chủ động, hệ thống so tổng khối lượng đã khớp với lượng lớn nhất từng hiện trên sổ ở giá đó. Khi khớp được <b>gấp 2 lần</b> lượng hiện ra, qua ít nhất 3 lệnh, và phần dư ít nhất bằng một lệnh lớn (top 5%), đó là nghi iceberg.</p><p>Trên Bookmap hiện thành vạch ngang và ô <b>I</b>: xanh ngọc là lệnh chờ MUA ẩn (đỡ giá), hồng là lệnh chờ BÁN ẩn (chặn giá). Nét liền là đã <b>giữ</b> được giá, nét đứt là đã bị <b>xuyên thủng</b>.</p><p><b>Lưu ý:</b> sàn crypto không công bố lệnh iceberg, nên đây là ước tính. Sổ lệnh Binance gửi 10 lần mỗi giây, nên một tường được nạp lại thật nhanh trông giống hệt iceberg; về mặt giao dịch hai thứ có cùng ý nghĩa: có người rất muốn mua hoặc bán ở giá đó.</p>"
  },
  {
    id: "tpo-read", group: "Hồ sơ khối lượng", term: "Đọc phiên TPO (Market Profile)",
    short: "Máy tự đọc từng phiên: kiểu mở cửa, kiểu ngày, hình dạng P/b/D/I, đỉnh/đáy yếu, đuôi từ chối, POC di chuyển, vùng chữ đơn lẻ chưa lấp, và thống kê phiên hôm sau.",
    body: "<p>Theo cách đọc của Dalton (Mind Over Markets). Dòng chữ trên mỗi cột: <b>kiểu ngày · kiểu mở cửa · hình dạng</b>, mũi tên là hướng.</p><ul><li><b>Kiểu mở cửa</b>: OD (mở là chạy), OTD (thử rồi chạy), ORR (bị từ chối rồi đảo), OA (đấu giá quanh giá mở). Tính từ 2 chữ đầu (IB, 60 phút đầu).</li><li><b>Kiểu ngày</b>: Trend, Double Distribution, Normal Variation, Normal, Neutral, Non-trend. So biên độ phiên với IB và xem phá IB một hay hai phía.</li><li><b>Hình dạng</b>: P (short bị ép mua lại), b (long bỏ chạy), D (cân bằng), I (xu hướng).</li><li><b>Đỉnh/đáy yếu</b> (vạch cam): mép phẳng, không có đuôi, hay bị quay lại phá. <b>Đuôi từ chối</b> (vạch tím bên trái): ≥ 2 dòng chữ đơn lẻ ở mép, phe dài hạn đã vào.</li><li><b>Đường IB</b> nét đứt xanh; phiên đang chạy có thêm mốc gấp đôi IB.</li><li><b>Vùng tím kéo sang phải</b>: chữ đơn lẻ chưa bị lấp.</li><li><b>Đường vàng nhỏ ở mép phải cột</b>: POC di chuyển theo từng chữ.</li></ul><p>Khung <b>Đọc phiên</b> tóm tắt phiên hiện tại và thống kê trên 30 ngày gần nhất: sau kiểu ngày giống hôm qua, phiên sau đóng cao hơn bao nhiêu phần trăm, quay về POC hôm trước bao nhiêu phần trăm, đỉnh/đáy yếu bị phá bao nhiêu phần trăm. Mặc định phiên theo giờ Việt Nam; có thể chọn ngày UTC hoặc phiên Mỹ.</p>",
  },
  {
    id: "fp-modes", group: "Footprint", term: "Chế độ ô footprint",
    short: "Cùng một nến, đọc theo nhiều cách: mua × bán, delta, tổng khối lượng, thanh mua/bán, hồ sơ trong nến, tỷ lệ chéo. Tô màu theo khối lượng, delta hoặc chỉ ô mất cân bằng.",
    body: "<p><b>Mua × Bán</b>: bên trái là bán chủ động (khớp vào giá chờ mua), bên phải là mua chủ động. <b>Mua × Bán + tổng</b>: thêm tổng khối lượng ở giữa. <b>Delta</b>: mua trừ bán ở từng mức, thấy ngay mức nào một phe áp đảo. <b>Khối lượng</b>: chỉ tổng, dễ thấy nơi giao dịch dày. <b>Thanh mua/bán</b>: thanh ngang từ giữa ô, trái là bán, phải là mua, hợp khi phóng nhỏ. <b>Hồ sơ trong nến</b>: hồ sơ khối lượng riêng từng nến, thấy nến có hình P, b hay cân bằng. <b>Tỷ lệ chéo</b>: mua ở dòng này chia bán ở dòng ngay dưới (cách ATAS tính mất cân bằng), từ 3× trở lên là in đậm.</p><p><b>Tô màu</b>: theo khối lượng (đậm là dày), theo delta (đậm là một phe áp đảo mạnh), chỉ mất cân bằng (chỉ tô ô từ 3× trở lên), theo nến.</p>",
  },
  {
    id: "fp-stats", group: "Footprint", term: "Bảng thống kê cụm (Cluster Statistic)",
    short: "Các dòng dưới biểu đồ footprint: khối lượng, delta, delta %, delta cao nhất và thấp nhất trong nến, số lệnh, khối lượng mỗi lệnh. Ô càng đậm là càng lớn so với các nến đang xem.",
    body: "<p>Giống Cluster Statistic của ATAS. Cách đọc hay dùng:</p><ul><li><b>Delta %</b> trên ±20% là một phe áp đảo rõ trong nến.</li><li><b>Δ cao nhất</b> lớn nhưng delta đóng nến nhỏ hoặc âm: phe mua đã đẩy mạnh rồi bị đẩy lùi (thường ở đỉnh). Ngược lại với <b>Δ thấp nhất</b> ở đáy.</li><li><b>KL/lệnh</b> tăng vọt: lệnh lớn đang vào. Nhiều lệnh mà mỗi lệnh nhỏ: nhỏ lẻ.</li></ul><p>Δ cao nhất/thấp nhất chỉ có ở nến dựng từ từng lệnh khớp thật (Binance tải được khoảng 400 nến gần nhất, cộng các nến từ lúc mở trang).</p>",
  },
  {
    id: "fp-auction", group: "Footprint", term: "Đấu giá chưa xong và kiệt sức",
    short: "Đường chấm cam: đỉnh hoặc đáy nến mà ở mức cực trị vẫn còn cả hai phe khớp, cuộc đấu giá chưa xong, giá hay quay lại. Chữ E tím: kiệt sức, lực chủ động cạn dần về phía cực trị.",
    body: "<p><b>Đấu giá chưa xong (unfinished auction)</b>: ở giá cao nhất của nến vẫn có cả mua chủ động và bán chủ động. Một đỉnh \"xong\" là chỗ không còn ai mua chủ động nữa. Đỉnh chưa xong giống câu nói bị bỏ dở: giá thường quay lại để hoàn tất. Đường chấm kéo sang phải tới khi giá quay lại vượt qua, lúc đó mờ đi.</p><p><b>Kiệt sức (exhaustion)</b>: mua chủ động giảm dần 3 dòng liền về phía đỉnh và dòng ở đỉnh chỉ còn dưới 30% dòng thứ ba (ngược lại với đáy). Người mua đã cạn sức, đỉnh dễ giữ.</p>",
  },
  {
    id: "fp-diverg", group: "Footprint", term: "Phân kỳ delta",
    short: "Tam giác đỏ trên đỉnh: nến lập đỉnh mới so với 3 nến trước mà delta âm. Tam giác xanh dưới đáy: lập đáy mới mà delta dương. Giá đi một đằng, phe chủ động đi một nẻo.",
    body: "<p>Giá lên đỉnh mới mà bên bán chủ động áp đảo nghĩa là giá được đẩy lên không phải nhờ người mua chủ động, mà có lệnh chờ bán lớn đang hấp thụ. Thường báo trước đảo chiều ngắn hạn, mạnh nhất khi trùng với kiệt sức hoặc đấu giá đã xong ở đỉnh. Chỉ tính khi |delta| từ 5% khối lượng nến trở lên.</p>",
  },
  {
    id: "stacked-imbalance", group: "Order flow nâng cao", term: "Mất cân bằng xếp chồng (stacked imbalance)",
    short: "Từ 3 ô footprint liền nhau trở lên mà mua chủ động gấp 3 lần bán (theo đường chéo) hoặc ngược lại. Vùng này hay thành hỗ trợ/kháng cự.",
    body: "<p>Cách so giống ATAS và Sierra Chart: mua chủ động ở giá P so với bán chủ động ở giá ngay dưới (P − 1 dòng), vì người mua chủ động khớp vào giá bán (ask) còn người bán chủ động khớp vào giá mua (bid). Ô nào gấp 3 lần trở lên được tô viền: xanh là mua lấn át, đỏ là bán lấn át.</p><p>Khi có từ 3 ô cùng phía liền nhau, hệ thống vẽ một <b>dải</b> kéo sang phải: dải xanh là vùng phe mua đã đẩy mạnh (thường đỡ giá khi quay lại), dải đỏ là vùng phe bán đẩy mạnh. Dải dừng lại khi có nến đóng cửa xuyên qua.</p><p>Chỉ có cho nến có footprint thật (từ lúc mở trang, hoặc tải lại lệnh khớp với Binance).</p>"
  },
  {
    id: "journal", group: "Công cụ", term: "Nhật ký giao dịch",
    short: "Ghi lại từng lệnh kèm lý do, lỗi đã mắc và cảm xúc, rồi thống kê xem bro thật sự kiếm tiền ở đâu và mất tiền vì đâu.",
    body: "<p>Mỗi lệnh ghi giá vào, cắt lỗ ban đầu và giá ra. Kết quả tính theo <b>R</b> (bội số của rủi ro ban đầu), nên so được các lệnh to nhỏ khác nhau. Lệnh chưa có giá ra là lệnh đang mở.</p><p>Thống kê chia theo chiến lược, theo lỗi, theo phía, giờ vào lệnh, thứ trong tuần và cảm xúc. Ô <b>Lệnh không mắc lỗi</b> so với <b>Lệnh có mắc lỗi</b> cho biết kỷ luật đáng giá bao nhiêu R mỗi lệnh.</p><p>Cần khoảng 30 lệnh trở lên thì thống kê mới bắt đầu đáng tin. Dữ liệu chỉ nằm trên trình duyệt của máy này; trên laptop và trên web là hai nhật ký riêng, dùng Xuất file / Nhập file để gộp.</p>"
  },
  {
    id: "risk-guard", group: "Công cụ", term: "Giới hạn rủi ro trong ngày",
    short: "Lỗ tối đa mỗi ngày và số lệnh tối đa mỗi ngày. Chạm giới hạn thì app báo đỏ: nên dừng tới ngày mai.",
    body: "<p>Quỹ và prop firm luôn có giới hạn lỗ ngày (thường 2 đến 5% vốn), vì sau vài lệnh thua người ta hay gỡ bằng lệnh to hơn. App cộng lãi/lỗ các lệnh đã đóng hôm nay (theo giờ máy) và so với giới hạn.</p><p><b>Rủi ro đang mở</b> là tổng số tiền sẽ mất nếu mọi lệnh đang mở chạm cắt lỗ. Khi có từ 2 lệnh cùng chiều, app nhắc rằng BTC, ETH, SOL thường chạy cùng nhau, nên rủi ro thật gần bằng tổng chứ không được chia nhỏ.</p>"
  },
  {
    id: "position-size", group: "Công cụ", term: "Tính khối lượng lệnh",
    short: "Từ vốn, % rủi ro, giá vào và cắt lỗ, tính số coin cần vào để nếu chạm cắt lỗ thì mất đúng số tiền đã định (đã gồm phí).",
    body: "<p>Khối lượng = số tiền chấp nhận mất ÷ (khoảng cắt lỗ + phí hai chiều). Ví dụ vốn 10.000 USDT, rủi ro 1% là 100 USDT; BTC vào 65.000, cắt lỗ 64.350 (cách 650) thì vào khoảng 0,15 BTC.</p><p>Đòn bẩy không đổi số tiền mất khi chạm cắt lỗ, nó chỉ đổi ký quỹ phải bỏ ra và giá thanh lý. App báo đỏ nếu cắt lỗ nằm sau giá thanh lý (ký quỹ cô lập, ước tính với ký quỹ duy trì 0,5%).</p>"
  },
  {
    id: "journal-mistakes", group: "Công cụ", term: "Lỗi đã mắc",
    short: "Đánh dấu lỗi kỷ luật của từng lệnh để biết lỗi nào làm mất nhiều R nhất.",
    body: "<p>Các lỗi phổ biến: vào sớm, FOMO đuổi giá, ngoài kế hoạch, dời cắt lỗ ra xa, chốt lời quá sớm, khối lượng quá lớn, gỡ lỗ, vào sát giờ ra tin, vào trễ. Bảng <b>Theo lỗi đã mắc</b> xếp lỗi gây thiệt hại nhiều nhất lên đầu: đó là thứ cần sửa trước tiên.</p>"
  },
  {
    id: "derivs", group: "Phái sinh", term: "Dữ liệu phái sinh",
    short: "Đám đông đang long hay short, tiền lớn nghiêng về đâu, futures đắt hay rẻ hơn spot, và thị trường quyền chọn đang đặt cược gì.",
    body: "<p>Lấy thẳng từ API công khai: Binance Futures (tỷ lệ long/short, mua/bán chủ động, funding, open interest; khung 1 giờ, 48 giờ gần nhất) và Deribit (quyền chọn BTC, ETH).</p><p><b>Cách dùng:</b> đây là bối cảnh, không phải tín hiệu vào lệnh. Đám đông nghiêng quá một phía cộng funding cao thường là nhiên liệu cho một cú quét ngược. Kết hợp với Bookmap để tìm điểm vào cụ thể.</p><p>Dòng tiền ETF và dòng coin nạp/rút sàn (on-chain) cần nguồn trả phí (Glassnode, CryptoQuant), chưa có trong app.</p>"
  },
  {
    id: "ls-ratio", group: "Phái sinh", term: "Tỷ lệ long/short",
    short: "Số tài khoản đang LONG chia số tài khoản đang SHORT trên Binance. Top trader là 20% tài khoản có ký quỹ lớn nhất, tính theo vị thế.",
    body: "<p>Tỷ lệ 2,0 nghĩa là cứ 2 tài khoản long thì có 1 tài khoản short (67% long). Nhỏ lẻ thường đứng sai phía ở các điểm cực: khi gần 70% tài khoản long mà giá không lên được, phe long dễ bị quét.</p><p>So <b>top trader</b> với <b>mọi tài khoản</b>: top trader long nhiều hơn đám đông là tiền lớn đang nghiêng về mua, và ngược lại.</p>"
  },
  {
    id: "taker-ratio", group: "Phái sinh", term: "Tỷ lệ mua/bán chủ động",
    short: "Khối lượng mua chủ động chia khối lượng bán chủ động trên Binance Futures trong mỗi giờ. Trên 1 là phe mua đánh mạnh hơn.",
    body: "<p>Giống delta nhưng tính cho cả sàn, theo giờ. Giá đi ngang trong khi tỷ lệ này liên tục trên 1 nghĩa là có người đang hấp thụ lệnh mua (bán chờ lớn phía trên).</p>"
  },
  {
    id: "basis", group: "Phái sinh", term: "Basis (chênh futures so với spot)",
    short: "Giá hợp đồng vĩnh cửu trừ giá chỉ số spot, tính theo %. Dương là futures đắt hơn spot: phe long đang hăng.",
    body: "<p>Basis dương lớn cùng funding cao là thị trường đang dùng đòn bẩy để mua, dễ có cú xả. Basis âm là phe short đông, hoặc tiền thật đang mua spot nhiều hơn (thường là dấu hiệu tốt hơn cho giá tăng bền).</p>"
  },
  {
    id: "funding", group: "Phái sinh", term: "Funding rate",
    short: "Phí mà phe long trả cho phe short (hoặc ngược lại) mỗi 8 giờ để giá futures bám giá spot.",
    body: "<p>Funding 0,01% mỗi 8 giờ là mức bình thường. Trên khoảng 0,05% là phe long đang trả phí rất đắt, giữ lệnh lâu sẽ mất tiền, và đám đông long quá đông. Funding âm sâu là ngược lại.</p>"
  },
  {
    id: "put-call", group: "Phái sinh", term: "Tỷ lệ Put/Call",
    short: "Tổng quyền chọn bán (put) chia tổng quyền chọn mua (call) trên Deribit, theo open interest hoặc theo khối lượng 24 giờ.",
    body: "<p>Put là bảo hiểm giảm giá, call là cược tăng giá. Tỷ lệ trên 1 nghĩa là thị trường đang mua bảo hiểm nhiều hơn cược tăng: tâm lý phòng thủ. Tỷ lệ rất thấp (dưới 0,5) là hưng phấn.</p><p>Tính theo khối lượng 24 giờ phản ánh tâm lý hôm nay; theo OI phản ánh vị thế tích luỹ.</p>"
  },
  {
    id: "max-pain", group: "Phái sinh", term: "Max pain",
    short: "Giá đáo hạn mà người mua quyền chọn nhận được ít tiền nhất, nghĩa là bên bán quyền chọn có lợi nhất.",
    body: "<p>Tính từ open interest của từng giá thực hiện trong một kỳ đáo hạn. Gần ngày đáo hạn (Deribit đáo hạn 8 giờ sáng UTC, tức 15 giờ Việt Nam, thứ Sáu), giá BTC hay bị hút về quanh max pain và các giá thực hiện có OI lớn, vì bên bán quyền chọn phòng hộ.</p><p>Hiệu ứng mạnh nhất ở kỳ đáo hạn lớn (cuối tháng, cuối quý).</p>"
  },
  {
    id: "iv-skew", group: "Phái sinh", term: "Lệch IV put − call",
    short: "Biến động kỳ vọng của put cách giá 10% trừ của call cách giá 10%, cùng kỳ đáo hạn. Dương là thị trường sợ giảm hơn sợ lỡ cú tăng.",
    body: "<p>Khi người ta trả giá cao cho put xa giá, đó là đang lo có cú sập. Lệch chuyển sang âm (call đắt hơn) thường thấy khi thị trường đang FOMO.</p>"
  },
  {
    id: "forward-test", group: "Backtest", term: "Kiểm tra tiến (forward test)",
    short: "Khoá bộ thông số tại một thời điểm, rồi chấm riêng các lệnh xảy ra sau đó. Đây là dữ liệu chiến lược chưa từng thấy lúc chọn thông số.",
    body: "<p>Backtest dù có chia trong mẫu / ngoài mẫu vẫn bị ảnh hưởng vì người chọn thông số đã nhìn thấy dữ liệu. Kiểm tra tiến thì không: chỉ các lệnh vào <b>sau</b> lúc bấm khoá mới được tính.</p><p>Không cần để máy chạy liên tục: nến lịch sử luôn tải lại được từ sàn, nên mỗi lần mở trang Backtest (hoặc bấm Cập nhật), app chạy lại chiến lược với đúng thông số đã khoá và chấm các lệnh mới.</p><p><b>Đọc kết quả:</b> dưới 10 lệnh thì chưa nói lên gì. Từ 30 lệnh mà cận dưới khoảng tin cậy vẫn trên 0 là lợi thế được xác nhận. Kỳ vọng sau khoá thấp hơn một nửa so với backtest là dấu hiệu thông số đã bị khớp quá mức với dữ liệu cũ.</p><p>Danh sách lưu trên trình duyệt của máy này.</p>"
  },
  {
    id: "econ-calendar", group: "Công cụ", term: "Lịch kinh tế",
    short: "Các tin kinh tế tác động mạnh trong tuần (CPI, việc làm, Fed...). Giờ hiển thị theo giờ máy của bro.",
    body: "<p>Nguồn: lịch ForexFactory, lọc giữ tin tác động <b>mạnh</b> (chấm đỏ) của mọi nước và tin <b>trung bình</b> (chấm cam) của Mỹ, vì crypto chạy theo đồng USD và lãi suất Mỹ.</p><p>Trong 3 giờ trước tin mạnh, trên thanh menu hiện dòng nhắc ⚠ đếm ngược; còn 30 phút thì chuyển đỏ. Bật cảnh báo trong nút 🔔 để được kêu trước 15 phút.</p><p>Quanh giờ ra tin, giá thường giật mạnh hai chiều và chênh lệch giá mua bán giãn rộng, cắt lỗ dễ bị trượt. Trader chuyên nghiệp thường đứng ngoài từ 5 đến 15 phút trước và sau tin.</p><p>Bản web cập nhật mỗi 30 phút; bản trên laptop lấy trực tiếp mỗi 10 phút.</p>"
  },
  {
    id: "crypto-news", group: "Công cụ", term: "Tin tức theo 6 mục",
    short: "Tin chia 6 mục: Kinh tế, Tài chính, Kim loại quý, Năng lượng, Địa chính trị, Crypto. 🔥 là tin nóng. Cập nhật mỗi 30 phút.",
    body: "<p>Nguồn: CNBC, MarketWatch, Investing.com, ForexLive, OilPrice, Google News (kim loại, năng lượng), BBC, Al Jazeera, thông cáo của Fed và ECB, cùng CoinDesk, Cointelegraph, Decrypt, The Block, Bitcoin Magazine.</p><p>Mục của mỗi tin được xếp tự động theo từ khoá trong tiêu đề, nên đôi khi xếp nhầm. Tiêu đề giữ nguyên tiếng Anh gốc để không sai thuật ngữ. Trong mục Crypto, nút <b>Mọi coin / Chỉ tin về ...</b> lọc theo đồng đang xem.</p><p>Bật \"Tin nóng mới\" trong nút 🔔 để được báo khi có tin nóng mới.</p>"
  },
  {
    id: "multibook", group: "Bookmap", term: "Multibook (gộp nhiều sàn)",
    short: "Cộng sổ lệnh và lệnh khớp của Binance, OKX và Bybit cho cùng một mã thành một bản đồ, như Bookmap Multibook.",
    body: "<p>Mỗi sàn chỉ là một phần thị trường. Một tường lệnh nhỏ trên Binance có thể là tường lớn khi cộng cả ba sàn. Khối lượng các sàn đều đổi ra số coin rồi cộng ở cùng mức giá (làm tròn theo bước giá của sàn đang chọn).</p><p><b>Lưu ý:</b> giá giữa các sàn lệch nhau vài bước giá là bình thường, nên quanh giá hiện tại sổ gộp hơi nhoè. Bong bóng, Smart Tape, footprint đều cộng lệnh khớp của cả ba sàn. Mã nào sàn khác không có thì sàn đó bị bỏ qua (xem Nhật ký kết nối). Tốn băng thông gấp khoảng 3 lần.</p>"
  },
  {
    id: "recorder", group: "Công cụ", term: "Máy ghi 24/7 (laptop)",
    short: "Chương trình chạy nền trên laptop, ghi sổ lệnh và lệnh khớp Binance Futures mỗi 2 giây, để Bookmap có lịch sử cả ngày.",
    body: "<p>Bấm đúp <b>Ghi du lieu 24-7.bat</b> trong thư mục Lai Long và để cửa sổ đó mở (thu nhỏ được). Muốn tự chạy khi bật máy: Win+R, gõ <code>shell:startup</code>, kéo một lối tắt của file đó vào thư mục vừa mở.</p><p>Chọn mã cần ghi, số ngày giữ lại và số giờ lịch sử nạp khi mở Bookmap trong nút ⚙ Cài đặt của Bookmap (chỉ hiện khi mở bằng \"Mo Lai Long.bat\"). Máy ghi tự nhận mã mới sau khoảng 1 phút.</p><p>Mỗi mã tốn khoảng 30 đến 60 MB mỗi ngày (file nén, trong thư mục data/record). Lịch sử được ghi trong ±1% quanh giá, mỗi 2 giây, nên chi tiết kém hơn phần trực tiếp một chút.</p>"
  },
  {
    id: "drawing", group: "Công cụ", term: "Vẽ đường và vùng giá",
    short: "Đánh dấu mức giá hoặc vùng giá quan trọng lên Bookmap và Footprint. Lưu theo từng mã trên máy này.",
    body: "<p><b>─ Đường:</b> bấm nút rồi bấm vào biểu đồ, có ngay một đường ngang tại giá đó. <b>▤ Vùng:</b> bấm nút rồi kéo dọc trên biểu đồ. Nét vẽ hiện trên cả Bookmap lẫn Footprint, có nhãn giá ở trục bên phải.</p><p>Bấm đúp lên đường (hoặc mép vùng) để xoá một hình; nút ✕ xoá hết của mã đang xem. Muốn được báo khi giá chạm, đặt mức giá trong nút 🔔.</p>"
  },
  {
    id: "tape-speed", group: "Bookmap", term: "Tốc độ băng",
    short: "Số lệnh khớp mỗi giây, vẽ bằng đường xanh lơ ở ô dưới Bookmap. Chấm sáng là lúc tốc độ vượt 3 lần mức thường.",
    body: "<p>Tốc độ băng tăng vọt nghĩa là nhiều người cùng lao vào một lúc: thường là lúc bắt đầu một cú chạy, lúc quét cắt lỗ, hoặc lúc ra tin. Tốc độ cao mà giá không đi được là dấu hiệu hấp thụ.</p><p>Mức \"thường\" là trung vị của vùng đang xem trên màn hình.</p>"
  },
  {
    id: "impact-map", group: "Công cụ", term: "Bản đồ tác động tin tức",
    short: "Mỗi ô là một chủ đề đang được nói tới trong 24 giờ qua. Ô càng đỏ càng nóng; 3 ô to nhất là 3 chủ đề nóng nhất. Rê chuột để xem nhanh, bấm để xem đầy đủ.",
    body: "<p>Độ nóng = số tin về chủ đề đó, tin có 🔥 tính gấp đôi, tin càng cũ càng nhẹ (giảm một nửa sau khoảng 8 giờ).</p><p>Bấm vào một ô để xem: các tài sản hay bị ảnh hưởng, cách đọc thường thấy (ví dụ lạm phát cao hơn dự báo thì USD tăng, vàng giảm), giá đã phản ứng thế nào sau các tin cùng loại gần đây, và toàn bộ tin của chủ đề.</p><p><b>Lưu ý:</b> \"cách đọc\" là phản ứng hay gặp, không phải quy luật. Thị trường có lúc phản ứng ngược khi tin đã được tính trước vào giá.</p>"
  },
  {
    id: "news-reaction", group: "Công cụ", term: "Giá phản ứng sau tin",
    short: "Với mỗi tin kinh tế mạnh đã ra trong 5 ngày, đo DXY, vàng, dầu, lợi suất 10 năm, S&P 500 và BTC đã chạy bao nhiêu sau 15, 30, 60 phút.",
    body: "<p>Giá trước tin là giá đóng cửa của nến 5 phút ngay trước giờ ra tin. Lợi suất đo bằng điểm cơ bản (bp, 1bp = 0,01%), các tài sản khác đo bằng %.</p><p>Bảng dưới cùng là mức chạy trung bình 60 phút sau tin (không tính chiều) của các lần ra tin đã lưu. Bảng này dài dần theo thời gian: hệ thống lưu lại mỗi lần ra tin trong khoảng 400 ngày. Tin nào làm thị trường chạy mạnh nhất là tin cần đứng ngoài.</p><p>Nguồn: Yahoo Finance, dữ liệu chậm khoảng 15 phút. Vàng, dầu, S&P 500 dùng hợp đồng tương lai gần nhất.</p>"
  },
  {
    id: "term-structure", group: "Thị trường", term: "Contango và backwardation (cấu trúc kỳ hạn)",
    short: "So sánh giá hai hợp đồng tương lai liền kề của cùng một hàng hoá. Xa đắt hơn gần là contango (hàng dư), gần đắt hơn xa là backwardation (hàng thiếu).",
    body: "<p><b>Contango</b>: hợp đồng tháng xa đắt hơn tháng gần. Thường gặp khi hàng đang dư, vì người giữ hàng phải trả phí kho bãi, bảo hiểm và lãi vốn. Người giữ long lâu dài sẽ mất tiền mỗi lần cuộn hợp đồng sang tháng sau.</p><p><b>Backwardation</b>: tháng gần đắt hơn tháng xa. Thị trường đang thiếu hàng ngay bây giờ nên người mua trả thêm để có hàng sớm. Đây thường là dấu hiệu cầu mạnh, hay gặp ở dầu khi tồn kho thấp.</p><p>Cột <b>Chênh lệch</b> là % giá HĐ kế tiếp so với HĐ gần, và quy ra % mỗi năm để so sánh giữa các hàng hoá có khoảng cách tháng khác nhau. Bảng xếp hạng theo giá trị giao dịch trong ngày (khối lượng × giá × hệ số hợp đồng).</p><p><b>Cách dùng</b>: backwardation ngày càng sâu cho thấy thị trường hàng thật đang căng; chuyển từ backwardation sang contango thường báo hiệu cầu yếu đi.</p>"
  },
  {
    id: "policy-rate", group: "Thị trường", term: "Lãi suất điều hành",
    short: "Lãi suất ngân hàng trung ương mỗi nước đang neo. Nước nào lãi suất cao hơn hoặc đang tăng lãi suất thì đồng tiền thường được hỗ trợ.",
    body: "<p>Lãi suất điều hành là mức ngân hàng trung ương đặt ra để điều tiết kinh tế: Fed (Mỹ), ECB (châu Âu), BOJ (Nhật), BOE (Anh), PBOC (Trung Quốc), RBA (Úc), BOC (Canada), SNB (Thuỵ Sĩ), HKMA (Hồng Kông). Số liệu lấy từ BIS (Ngân hàng Thanh toán Quốc tế).</p><p><b>Lần đổi gần nhất</b> cho biết lần cuối họ tăng hay giảm bao nhiêu điểm cơ bản (100 điểm = 1%).</p><p><b>Cách đọc</b>: chênh lệch lãi suất giữa hai nước là động lực lớn của tỷ giá. Ví dụ Fed giữ lãi suất cao trong khi BOJ giữ thấp thì USD/JPY có xu hướng tăng. Bấm vào một đồng tiền để xem lịch dữ liệu (lạm phát, việc làm, quyết định lãi suất) và tin liên quan của nước đó.</p>"
  },
  {
    id: "crypto-top", group: "Thị trường", term: "Crypto top 10 vốn hoá",
    short: "10 đồng crypto có vốn hoá lớn nhất (đã bỏ stablecoin và token bọc). BTC và ETH được tô nổi.",
    body: "<p>Vốn hoá = giá × lượng coin đang lưu hành. Cột tỷ trọng là phần của mỗi coin trong tổng vốn hoá top 10: tỷ trọng BTC tăng thường là lúc thị trường thận trọng, tiền rút khỏi altcoin về BTC.</p><p>Nguồn CoinGecko, cập nhật mỗi 30 phút.</p>"
  },
  {
    id: "etf-flow", group: "Thị trường", term: "Dòng tiền ETF BTC/ETH",
    short: "Số tiền vào (xanh) hoặc ra (đỏ) khỏi các quỹ ETF giao ngay BTC và ETH tại Mỹ mỗi ngày, triệu USD.",
    body: "<p>Khi tiền vào ETF, quỹ phải mua coin thật, nên dòng tiền vào liên tục là lực mua lớn của tổ chức. Dòng tiền ra liên tục nhiều phiên là dấu hiệu tổ chức đang giảm tỷ trọng.</p><p>Cột lớn nhất là IBIT (BlackRock). GBTC và ETHE (Grayscale) phí cao nên thường bị rút ra.</p><p>Nguồn Farside Investors, số liệu chốt sau giờ đóng cửa chứng khoán Mỹ. Rê chuột lên từng cột để xem ngày và số tiền.</p>"
  },
  {
    id: "treasury", group: "Thị trường", term: "Công ty nắm giữ BTC/ETH",
    short: "Các công ty niêm yết đang giữ BTC hoặc ETH trong bảng cân đối, xếp theo số coin.",
    body: "<p>Nhiều công ty (Strategy, Metaplanet, BitMine…) phát hành cổ phiếu hoặc trái phiếu để mua coin. Khi họ mua thêm là có lực mua thật; khi cổ phiếu của họ giảm mạnh, thị trường lo họ phải bán coin.</p><p>Nguồn CoinGecko. Theo dõi thêm tin \"ETF và quỹ\" trên bản đồ tác động tin tức ở tab Phân tích.</p>"
  },
  {
    id: "live-liq", group: "Thị trường", term: "Thanh lý lớn trực tiếp",
    short: "Mọi lệnh thanh lý cưỡng bức trên Binance Futures từ ngưỡng bạn chọn trở lên, nhận trực tiếp.",
    body: "<p>Khi vị thế dùng đòn bẩy lỗ hết ký quỹ, sàn đóng cưỡng bức. LONG bị thanh lý là lệnh bán ép, SHORT bị thanh lý là lệnh mua ép.</p><p>Một loạt LONG bị thanh lý liên tiếp thường đẩy giá xuống sâu rồi hồi; một loạt SHORT bị thanh lý (short squeeze) đẩy giá lên nhanh. Thanh lý dồn dập thường xảy ra gần đáy hoặc đỉnh ngắn hạn.</p><p>Lưu ý: Binance chỉ gửi lệnh thanh lý lớn nhất mỗi giây của mỗi cặp, nên đây là con số thấp hơn thực tế.</p>"
  },
  {
    id: "whales", group: "Thị trường", term: "Cá voi dùng đòn bẩy (Hyperliquid)",
    short: "Các ví lớn nhất trên sàn Hyperliquid đang mở vị thế gì, đòn bẩy bao nhiêu, còn cách giá thanh lý bao xa.",
    body: "<p>Hyperliquid là sàn phi tập trung nên mọi vị thế đều công khai theo địa chỉ ví. Danh sách lấy từ bảng xếp hạng tài khoản lớn nhất, chỉ giữ ví đang có vị thế.</p><p><b>Đòn bẩy thực</b> = tổng vị thế mở / tiền trong tài khoản. <b>Cách thanh lý</b>: giá còn phải chạy bao nhiêu % ngược chiều thì ví bị thanh lý; ô tô đỏ là dưới 10%.</p><p>Ô trên cùng cho biết nhóm cá voi đang nghiêng LONG hay SHORT với BTC và ETH. Bấm một ví để xem toàn bộ vị thế, bấm tên ví để mở trên Hypurrscan. Nút \"Lấy lại trực tiếp\" hỏi thẳng Hyperliquid để có số mới nhất.</p><p><b>Lưu ý</b>: cá voi cũng có thể sai, và một vị thế có thể đang được phòng hộ ở sàn khác.</p>"
  },
  {
    id: "opt-read", group: "Phái sinh", term: "Đọc tâm lý quyền chọn",
    short: "Máy ghép các chỉ số tổ chức hay theo dõi (skew 25 delta, cấu trúc kỳ hạn IV, chỉ số biến động, IV so với biến động thực tế, put/call, dòng lệnh lớn, GEX) thành vài câu: thị trường đang sợ hay tham, nghiêng về đâu.",
    body: "<p>Thị trường quyền chọn là nơi người ta trả tiền thật để mua bảo hiểm hoặc đặt cược, nên nó lộ tâm lý rõ hơn hợp đồng tương lai. Dòng xanh là nghiêng tăng, đỏ là nghiêng giảm hoặc sợ hãi, trắng là trung tính.</p><ul><li><b>IV ATM 7 và 30 ngày</b>: nội suy về đúng 7 và 30 ngày để so sánh được qua thời gian.</li><li><b>Skew 25Δ</b> (risk reversal): IV call 25 delta trừ IV put 25 delta. Âm sâu là sợ giảm, dương là tham.</li><li><b>Butterfly 25Δ</b>: giá của cú biến động lớn ở cả hai phía.</li><li><b>IV − thực tế</b>: dương nhiều là quyền chọn đắt, có lợi cho người bán quyền chọn.</li></ul><p>BTC/ETH là dữ liệu Deribit trực tiếp. Tài sản Mỹ là CBOE trễ 15 phút.</p>",
  },
  {
    id: "opt-term", group: "Phái sinh", term: "Cấu trúc kỳ hạn IV và skew",
    short: "Đường cam là IV ATM theo số ngày tới hạn; đường đỏ/xanh nét đứt là IV của put/call 25 delta. Bình thường hạn dài IV cao hơn (contango); hạn ngắn vọt lên trên hạn dài (đảo ngược) là thị trường đang sợ một chuyện sắp tới.",
    body: "<p>Trục ngang theo căn bậc hai số ngày để các hạn gần không bị dồn lại. Khoảng cách giữa đường đỏ và xanh chính là skew: đỏ cao hơn xanh là put đắt hơn call. Bảng bên dưới ghi từng hạn: IV ATM, IV put/call 25 delta, skew (call − put) và butterfly.</p><p>Delta tính theo Black-Scholes với lãi suất 0 và giá kỳ hạn bằng giá hiện tại, đủ chính xác để so sánh tương đối.</p>",
  },
  {
    id: "opt-volidx", group: "Phái sinh", term: "Chỉ số biến động (DVOL, VIX, VXN, GVZ, OVX, MOVE)",
    short: "Chỉ số biến động 30 ngày tính từ giá quyền chọn: DVOL cho BTC/ETH (Deribit, trực tiếp), VIX cho S&P 500, VXN cho Nasdaq, RVX cho Russell, GVZ cho vàng, OVX cho dầu, MOVE cho trái phiếu (Yahoo, trễ). Kèm IV rank 1 năm.",
    body: "<p><b>IV rank</b> = (hiện tại − thấp nhất năm) / (cao nhất năm − thấp nhất năm). <b>IV percentile</b> = phần trăm số ngày trong năm thấp hơn hiện tại. Trên 80% là quyền chọn đắt, thị trường đã sợ sẵn; dưới 20% là rẻ, thị trường chủ quan và biến động hay bùng ra từ đây. Đường xanh nhạt nét đứt là biến động thực tế 30 ngày để so.</p>",
  },
  {
    id: "opt-sources", group: "Phái sinh", term: "Nguồn dữ liệu quyền chọn",
    short: "Bảng liệt kê từng phần dữ liệu của tài sản đang xem lấy từ đâu, đang trực tiếp hay trễ, và bao lâu cập nhật một lần. Nhãn chuyển đỏ khi dữ liệu cũ hơn mức nó phải có.",
    body: "<p><b>BTC, ETH</b>: mọi thứ lấy thẳng từ Deribit (sàn quyền chọn crypto lớn nhất) trong trình duyệt, là dữ liệu trực tiếp. Giá đóng cửa ngày lấy từ Binance Futures.</p><p><b>Chỉ số và ETF Mỹ</b> (SPX, NDX, SPY, QQQ…): chuỗi quyền chọn từ CBOE, miễn phí nhưng trễ 15 phút; bản web lấy lại mỗi 30 phút nên số liệu có thể cũ tới 45 phút. Chỉ số biến động (VIX, VXN…) và giá đóng cửa từ Yahoo Finance theo ngày. Không có nguồn miễn phí cho từng lệnh khớp của quyền chọn Mỹ.</p><p>GEX, delta, max pain, biên độ dự kiến là số tự tính từ chuỗi, nên trễ đúng bằng chuỗi.</p>",
  },
  {
    id: "opt-chain", group: "Phái sinh", term: "Bảng chuỗi quyền chọn (depth view)",
    short: "Toàn bộ quyền chọn của một hạn: call bên trái, put bên phải, mỗi dòng một strike. Có OI (thanh màu), khối lượng, IV, delta, giá mua và giá bán.",
    body: "<p><b>Cách đọc</b>: dòng cam đậm là strike sát giá (ATM), dải ngang ghi giá hiện tại. Ô tô đậm là quyền chọn đang có lãi nội tại (ITM). Thanh xanh/đỏ dài là strike có nhiều hợp đồng mở: nơi nhà tạo lập phải phòng hộ nhiều nhất. CW, PW, MP là tường call, tường put và max pain của riêng hạn này. ⚑ là strike có khối lượng hôm nay vượt OI: có người mở vị thế mới lớn.</p><p><b>Biên độ dự kiến</b> lấy từ giá straddle ATM (mua cả call và put tại strike sát giá): thị trường đang trả tiền cho mức dao động chừng đó tới ngày đáo hạn.</p><p><b>Delta</b> gần như xác suất quyền chọn kết thúc có lãi: call delta 0,25 là khoảng 25%.</p>",
  },
  {
    id: "risk-lock", group: "Công cụ", term: "Khoá giao dịch tự động",
    short: "Lỗ ngày, lỗ tuần chạm giới hạn hoặc thua liên tiếp đủ số lệnh thì app tự khoá: không ghi được lệnh mới, lệnh giả lập mới bị chặn.",
    body: "<p><b>Ba điều kiện khoá</b>: lỗ hôm nay chạm % vốn tối đa mỗi ngày (khoá tới 00:00 hôm sau), thua liên tiếp đủ số lệnh trong ngày (khoá tới 00:00 hôm sau), lỗ tuần này chạm % vốn đầu tuần (khoá tới thứ Hai tuần sau, 00:00).</p><p><b>Không mở khoá sớm được</b>: sửa hay xoá lệnh lỗ trong nhật ký không làm mất khoá. Vẫn được đóng lệnh đang mở và đóng bớt vị thế giả lập.</p><p><b>Giới hạn</b>: app chỉ khoá được nhật ký và lệnh giả lập. Tài khoản thật trên sàn thì bro phải tự dừng, hoặc dùng tính năng tự khoá của sàn nếu có.</p>",
  },
  {
    id: "discipline-gate", group: "Công cụ", term: "Gác cổng kỷ luật",
    short: "Hỏi lại trước khi ghi lệnh giống gỡ gạc, quá rủi ro hoặc sát giờ tin mạnh; báo trước khi sắp bị khoá và báo khi đã khoá, qua tiếng và Telegram.",
    body: "<p><b>Gỡ gạc</b>: lệnh mới vào trong 15 phút sau một lệnh thua. App ghi rõ cách lệnh thua bao nhiêu phút, có cùng mã, đảo chiều hay tăng rủi ro so với lệnh vừa thua không. Đây là kiểu lệnh cảm xúc hay gặp nhất.</p><p><b>Quá rủi ro</b>: lệnh mất nhiều hơn 1,25 lần mức % vốn mỗi lệnh nếu chạm cắt lỗ. <b>Sát giờ tin</b>: vào lệnh từ 15 phút trước tới 5 phút sau một tin mạnh trong lịch kinh tế.</p><p><b>Khi ghi lệnh</b>: lệnh có dấu hiệu trên thì app hỏi lại trước khi lưu. Bro vẫn ghi được, lệnh được gắn nhãn ⚠ trong bảng và cột gac_cong trong file Excel, để sau này so lệnh bị cảnh báo với lệnh bình thường. Lệnh ghi bù (cách hiện tại hơn 60 phút) chỉ được gắn nhãn, không hỏi lại. Ô tính khối lượng cũng hiện cảnh báo gỡ gạc và sát giờ tin trước khi bro vào lệnh.</p><p><b>Sắp khoá</b>: còn 1 lệnh thua nữa là đủ chuỗi thua, hoặc lỗ ngày, lỗ tuần đã tới 66% giới hạn (kèm số tiền còn được lỗ và tương đương mấy lệnh thua), hoặc còn 1 lệnh nữa là đủ số lệnh tối đa trong ngày. Mỗi mốc chỉ báo một lần. <b>Đã khoá</b>: báo lý do, giờ mở khoá và tóm tắt hôm nay.</p><p>Bật hoặc tắt ở menu Cảnh báo. Gửi Telegram khi đã bật Gửi qua Telegram.</p>",
  },
  {
    id: "shock-test", group: "Công cụ", term: "Kịch bản sốc trước tin lớn",
    short: "60 phút trước tin lớn, tính các lệnh đang mở trong nhật ký sẽ lời lỗ bao nhiêu nếu giá giật mạnh, so với mức còn được lỗ hôm nay, rồi báo qua tiếng và Telegram.",
    body: "<p><b>Tin lớn</b>: tin mạnh trong lịch kinh tế của Mỹ, châu Âu, Anh, Nhật, Trung Quốc. Các tin ra cùng giờ (CPI và Core CPI) gộp làm một.</p><p><b>Mức sốc</b> của mỗi mã = hệ số × biên độ trung bình một ngày (ATR 14 nến ngày Binance, theo %). Hệ số 1 với tin rất mạnh của Mỹ (CPI, việc làm phi nông nghiệp, Fed, PCE), 0,6 với tin mạnh khác của Mỹ, 0,4 với tin của nước khác. Mã không có trên Binance thì dùng biên độ ước lượng: coin 4%, kim loại 1,5%, dầu 2,5%, ngoại hối 0,6%.</p><p><b>Ba kịch bản</b>: đồng tiền của tin mạnh lên, yếu đi (coin, vàng, dầu tính bằng USD nên USD mạnh thì giá giảm), và giật hai chiều quét cả hai phía (mọi lệnh cùng bị đi ngược, trường hợp xấu nhất). Giá chạm cắt lỗ thì tính lỗ tới cắt lỗ cộng trượt giá bằng 20% quãng sốc; chạm mục tiêu thì chốt ở mục tiêu.</p><p><b>Màu</b>: 🟢 lời, 🟡 lỗ dưới nửa mức còn được lỗ hôm nay, 🟠 từ nửa trở lên, 🔴 chạm mức khoá giao dịch. Kèm mức giá đã chạy trung bình 60 phút sau các lần ra tin cùng loại, nếu đã lưu được.</p><p>Chỉ tính các lệnh đang mở có khối lượng trong nhật ký, theo cắt lỗ ban đầu đã ghi. Mỗi tin báo một lần. Bật hoặc tắt ở menu Cảnh báo; nút Tính ngay ở trang Nhật ký để xem trước bất cứ lúc nào.</p>",
  },
  {
    id: "compass", group: "Công cụ", term: "La bàn sáng",
    short: "Mỗi ngày một bản tin: hướng vĩ mô, COT, lịch tin mạnh hôm nay và ngân sách rủi ro trong ngày. Gửi qua Telegram vào giờ bro chọn.",
    body: "<p><b>Vĩ mô</b>: USD mạnh lên hay yếu đi theo DXY (5 phiên lệch quá 0,4%, 20 phiên lệch quá 1%), tâm lý thị trường theo VIX (từ 25 hoặc cao hơn VIX 3 tháng là sợ hãi, dưới 15 là ưa rủi ro), dòng tiền ETF BTC 5 phiên (từ 200 triệu USD). Gộp lại thành gió xuôi / gió ngược cho coin, vàng, dầu: USD mạnh là gió ngược vì chúng tính bằng USD; sợ hãi là gió ngược cho coin và dầu nhưng là gió xuôi cho vàng.</p><p><b>COT</b>: chỉ số COT 3 năm của đầu cơ lớn ở USD, Bitcoin, Ether, vàng, dầu, cộng các hợp đồng đang ở cực trị (từ 90 hoặc tới 10). Báo cáo ra thứ Sáu, số liệu tính tới thứ Ba.</p><p><b>Lịch tin</b>: tin mạnh trong ngày theo giờ máy, ⭐ là tin rất mạnh của Mỹ, kèm khung nên đứng ngoài (15 phút trước tới 5 phút sau).</p><p><b>Ngân sách rủi ro</b>: lấy từ cài đặt và lệnh trong nhật ký: rủi ro mỗi lệnh, còn được lỗ bao nhiêu trước khi bị khoá, còn mấy lệnh.</p><p>Đây là bối cảnh trong vài ngày, không phải tín hiệu vào lệnh. Tin tự gửi mỗi ngày một lần vào giờ đã chọn; nếu lúc đó Desk chưa mở thì gửi ngay khi mở trong ngày. Tắt ở menu Cảnh báo.</p>",
  },
  {
    id: "consensus", group: "Công cụ", term: "Đồng thuận 4 lớp",
    short: "Báo khi vĩ mô, COT, cấu trúc giá và order flow của một mã cùng ủng hộ một hướng, kèm vùng vào, cắt lỗ và khối lượng đã tính sẵn.",
    body: "<p><b>Vĩ mô</b>: gió xuôi / gió ngược của La bàn sáng cho nhóm của mã (coin, vàng, dầu). <b>COT</b>: đầu cơ lớn tăng hay giảm vị thế ròng trong tuần từ 1% open interest; nếu chỉ số COT từ 90 thì nghiêng xuống (đám đông long đã chật), tới 10 thì nghiêng lên (dễ bị ép mua lại). Altcoin dùng COT Bitcoin CME làm đại diện.</p><p><b>Cấu trúc giá</b> nến 1 giờ: giá trên EMA20 trên EMA50, EMA20 đi lên, đỉnh và đáy 12 nến gần nhất không thấp hơn 12 nến trước (ngược lại cho SHORT). <b>Order flow</b> nến 1 giờ: mua chủ động nhiều hơn bán từ 3% khối lượng 24 nến và 6 nến gần nhất vẫn mua ròng (ngược lại cho SHORT).</p><p><b>Kế hoạch</b>: vùng vào từ giá đóng cửa lùi tối đa 1 ATR về phía EMA20; cắt lỗ cách giữa vùng bằng hệ số ATR trong cài đặt nhật ký; mục tiêu 2R; khối lượng theo % rủi ro mỗi lệnh (đã gồm phí). Nút Đưa vào ô tính điền sẵn vào ô Tính khối lượng lệnh.</p><p>Quét mỗi 5 phút bằng nến 1 giờ đã đóng của Binance Futures. Mỗi lần một mã vào trạng thái 4/4 chỉ báo một lần; đang khoá giao dịch thì không báo; có tin lớn trong 60 phút thì tin báo kèm nhắc đợi qua tin. Đủ 4 lớp không có nghĩa là chắc thắng: đây là bộ lọc, nên chấm điểm thật bằng nhật ký.</p>",
  },
  {
    id: "risk-atr", group: "Công cụ", term: "Cắt lỗ và khối lượng theo ATR",
    short: "Cắt lỗ đặt cách giá vào một bội số ATR (biên độ trung bình 14 nến). Khối lượng tự giảm khi thị trường biến động mạnh, nên số tiền rủi ro mỗi lệnh luôn bằng nhau.",
    body: "<p>Chọn phía và khung, bấm Tính: app lấy 100 nến Binance Futures của mã, tính ATR 14 của nến đã đóng gần nhất, đặt cắt lỗ cách giá vào hệ số × ATR rồi tính khối lượng theo % rủi ro.</p><p>Hệ số 1–1,5 hợp lướt sóng, 2–3 hợp giữ lệnh dài. Cắt lỗ theo ATR tránh bị nhiễu quét khi thị trường đang dao động rộng.</p>",
  },
  {
    id: "radar-setups", group: "Radar", term: "Luật vào/ra 2 setup và thống kê sau phí",
    short: "Biến hai sự kiện Đánh thức và Cạn khối lượng thành lệnh có luật rõ ràng (xác nhận, giá vào, cắt lỗ, chốt lời, hết giờ), rồi đo kết quả sau phí và trượt giá.",
    body: "<p><b>Đánh thức</b> đánh theo hướng sự kiện, <b>Cạn khối lượng</b> đánh ngược xu hướng đã hết lửa. Cả hai đều chờ một nến xác nhận, vào ở giá mở nến kế tiếp, nên không nhìn trước tương lai.</p><p><b>Sau phí</b>: phí taker hai chiều cộng trượt giá hai chiều, đổi ra R theo khoảng cắt lỗ. Cắt lỗ càng gần thì phí ăn càng nhiều R.</p><p><b>Tin được khi</b>: từ 30 lệnh trở lên và cận dưới khoảng tin cậy 95% trên 0. Dòng mờ là chưa đủ lệnh.</p>",
  },
  {
    id: "perf-report", group: "Công cụ", term: "Báo cáo hiệu suất theo tháng",
    short: "Lợi nhuận, % lợi nhuận, sụt giảm tối đa, tỷ lệ thắng, kỳ vọng mỗi lệnh, profit factor, Sharpe theo từng tháng. Nguồn: nhật ký, lịch sử Binance thật hoặc file CSV từ sàn.",
    body: "<p><b>Binance (laptop)</b>: tạo khoá API chỉ có quyền đọc (Enable Reading), nên giới hạn IP. Khoá lưu trên laptop, chỉ gửi tới Binance. Binance chỉ trả khoảng 3 tháng gần nhất qua API; cũ hơn thì xuất file CSV trên web Binance.</p><p><b>File CSV</b>: chạy được cả trên bản web. App tự tìm cột thời gian, mã, lãi/lỗ đã chốt và phí.</p><p><b>In / lưu PDF</b> tạo bản báo cáo sạch để gửi nhà đầu tư. Nhà đầu tư thường xem sụt giảm tối đa và độ đều của các tháng trước, lợi nhuận sau.</p>",
  },
  {
    id: "data-health", group: "Công cụ", term: "Sức khoẻ dữ liệu",
    short: "Mỗi nguồn dữ liệu: đang chạy hay lỗi, độ trễ đo thật trên máy này, lần nhận cuối và số lần gọi được/lỗi.",
    body: "<p><b>Độ trễ WebSocket</b>: giờ máy lúc nhận trừ giờ sàn ghi trên tin, đã trừ lệch đồng hồ máy so với Binance. Trên 1 giây là mạng hoặc máy đang chậm.</p><p><b>REST</b>: thời gian khứ hồi một lần gọi. <b>File dữ liệu</b>: tuổi của file (web cập nhật 30 phút một lần).</p><p><b>Lỗi</b> thường do sàn chặn IP (một số sàn chặn Việt Nam hoặc Mỹ) hoặc mất mạng. <b>Phiên này chưa dùng</b> là chưa mở trang dùng nguồn đó.</p>",
  },
  {
    id: "backup", group: "Công cụ", term: "Sao lưu toàn bộ",
    short: "Xuất một file JSON gồm mọi dữ liệu lâu dài của app trên máy này, để chuyển sang máy mới hoặc cất lên Google Drive.",
    body: "<p><b>Có trong file</b>: nhật ký giao dịch kèm trạng thái khoá rủi ro, tài khoản giả lập, bố cục đã lưu, báo cáo hiệu suất (cả CSV đã nạp), các chiến lược đang forward test.</p><p><b>Không có</b>: mã Telegram và khoá API sàn. File có thể nằm trên Drive nên các bí mật này phải nhập lại trên máy mới.</p><p>Khôi phục sẽ thay dữ liệu cùng loại trên máy đang dùng. Nên sao lưu mỗi tuần.</p>",
  },
  {
    id: "signals-book", group: "Fractal & kiểm chứng", term: "Sổ tín hiệu tự chấm điểm",
    short: "Mọi tín hiệu phân tích của app được ghi lại rồi tự chấm: sau 15 phút, 1 giờ, 4 giờ, 24 giờ giá đi đúng hướng bao nhiêu, đã trừ phí và trượt giá. Chỉ tín hiệu qua kiểm chứng mới được gọi là có lợi thế.",
    body: "<p><b>Ghi những gì</b>: sự kiện Radar, hấp thụ, delta phân kỳ, cá voi mua/bán dồn (cần kho lịch sử), OI tăng/giảm bất thường, tay to đổi phe so với đám đông, lần đầu giá chạm vùng hợp lưu. Các tín hiệu chỉ thấy khi xem trực tiếp (tường bị rút, tường bị ăn, iceberg giữ hoặc bị xuyên, Big Trade) được ghi lúc bro mở Terminal, rồi chấm dần.</p><p><b>Luật chấm</b>: vào ở giá mở của nến ngay sau tín hiệu, ra ở giá đóng sau N nến. Lãi/lỗ đo bằng ATR lúc có tín hiệu để so được giữa các giai đoạn, đã trừ phí taker và trượt giá hai chiều. <b>Hơn nền</b> là phần hơn so với vào lệnh ngẫu nhiên cùng hướng ở mọi nến.</p><p><b>Có lợi thế</b> chỉ khi đủ 3 điều: ít nhất 30 lần; 70% sự kiện đầu có khoảng tin cậy 95% của kỳ vọng sau phí nằm trên 0; và 30% sự kiện cuối (phần chưa dùng để đánh giá) vẫn dương. Thiếu một điều là Chưa rõ. Cách này chống tự lừa mình khi chỉ nhìn vài lần thắng đẹp.</p><p>Kết quả được lưu trên máy (có trong file sao lưu) để lọc cảnh báo và soạn kế hoạch phiên.</p>",
  },
  {
    id: "context-tags", group: "Fractal & kiểm chứng", term: "Nhãn bối cảnh",
    short: "Mỗi nến được gắn nhãn điều kiện thị trường lúc đó: phiên, biến động, xu hướng 24 giờ, vị trí so với vùng giá trị hôm trước, OI 4 góc, tay to so với đám đông, gamma, tin mạnh. Thống kê tín hiệu được tách theo từng nhãn.",
    body: "<p>Cùng một tín hiệu nhưng xảy ra giờ Á hay giờ Mỹ, lúc biến động thấp hay cao, thì kết quả rất khác. Lợi thế thật thường nằm ở chỗ biết tín hiệu chạy tốt trong điều kiện nào và đứng ngoài trong điều kiện còn lại.</p><p><b>Phiên</b> (giờ Việt Nam): Á 7h–14h, Âu 14h–20h30, Mỹ 20h30–3h, ngoài giờ 3h–7h. <b>Biến động</b>: ATR so với 30 ngày trước, chia 3 phần. <b>Xu hướng</b>: giá 24 giờ đi xa hơn 1 lần độ lệch kỳ vọng. <b>OI 4 góc</b>: long mới mở, short đóng, short mới mở, long xả. <b>Tay to</b>: tỷ lệ long/short top trader so với mọi tài khoản, lệch hơn 1 độ lệch chuẩn của 7 ngày. <b>Gamma</b>: chỉ có khi xem trực tiếp BTC/ETH.</p><p>Mọi nhãn chỉ dùng dữ liệu tới nến đó, không nhìn trước. Nhóm dưới 15 lần thì chưa kết luận. Trong từng bối cảnh, \"Có lợi thế\" dùng khoảng tin cậy 99% thay vì 95%, vì soi hàng chục nhóm cùng lúc thì kiểu gì cũng có vài nhóm đẹp do may.</p>",
  },
  {
    id: "confluence", group: "Hỗ trợ / kháng cự", term: "Vùng hợp lưu",
    short: "Nơi nhiều mức giá quan trọng từ các nguồn khác nhau trùng nhau: POC, VAH/VAL, đỉnh/đáy hôm qua, POC tuần, POC chưa chạm, hỗ trợ/kháng cự đã test, VWAP, tường call/put, điểm lật gamma, cụm thanh lý, tường lệnh, iceberg. Càng nhiều nguồn, điểm càng cao.",
    body: "<p><b>Điểm</b>: tổng trọng số các loại nguồn trong vùng, mỗi loại chỉ tính một lần (hai mức hỗ trợ sát nhau không nhân đôi). POC, POC chưa chạm, tường quyền chọn, điểm lật gamma 2 điểm; VAH/VAL, đỉnh/đáy hôm qua, POC tuần, cụm thanh lý, tường lệnh, iceberg 1,5; còn lại 1.</p><p>Các mức cách nhau dưới 0,25 ATR được gộp. Vùng từ 3 điểm tô vàng trên Bookmap và footprint (tắt ở Lớp hiển thị).</p><p><b>Đã kiểm chứng chưa</b>: sổ tín hiệu chấm lần đầu mỗi ngày giá chạm vùng theo 3 hạng điểm, xem vùng điểm cao có bật lại nhiều hơn vùng 1 nguồn không. Phần lịch sử chỉ dựng được từ nến (không có quyền chọn, tường, iceberg quá khứ).</p>",
  },
  {
    id: "hist-store", group: "Công cụ", term: "Kho lịch sử data.binance.vision",
    short: "Binance công bố miễn phí toàn bộ lệnh khớp, OI, tỷ lệ long/short và độ sâu sổ lệnh từng ngày ở data.binance.vision. Bản laptop tải về, gom gọn và lưu trên ổ để sổ tín hiệu chấm được nhiều năm.",
    body: "<p><b>Có gì</b>: nến 1 phút có tách mua/bán chủ động và khối lượng lệnh cá voi (từ 250 nghìn USD với BTC, 100 nghìn với ETH, 50 nghìn với mã khác), footprint 5 phút, danh sách lệnh lớn (từ 1 triệu USD với BTC, 500 nghìn với ETH), OI và tỷ lệ long/short theo 5 phút, độ sâu sổ lệnh ±1%, ±2%, ±5%.</p><p><b>Cách tải</b>: tab Tín hiệu, nhập mã và số ngày, bấm Tải về; hoặc dòng lệnh <code>python -m lailong.cli vision BTCUSDT ETHUSDT --days 365</code>. Ngày đã có sẽ bỏ qua; ngày Binance chưa công bố sẽ thử lại sau 24 giờ.</p><p>Số của mỗi ngày có từ hôm sau. Bản web không có kho này, chỉ dùng nến và 30 ngày OI.</p>",
  },
  {
    id: "session-plan", group: "Công cụ", term: "Kế hoạch trước phiên",
    short: "Trước mỗi phiên Á, Âu, Mỹ, app soạn sẵn một trang: bối cảnh lúc này, vùng hợp lưu gần giá, những tín hiệu đã kiểm chứng có lợi thế trong đúng bối cảnh đó, tin mạnh 12 giờ tới, tín hiệu 24 giờ qua. Có thể tự gửi qua Telegram.",
    body: "<p>Mục tiêu là vào phiên với kế hoạch đã viết sẵn, không mở app ra mới nghĩ. Khi không có tín hiệu nào qua kiểm chứng trong bối cảnh hiện tại, kế hoạch ghi rõ để bro đứng ngoài hoặc giảm khối lượng.</p><p><b>Chỉ báo tín hiệu đã kiểm chứng</b> (trong nút 🔔): iceberg, tường bị rút và Big Trade chỉ kêu khi sổ tín hiệu đã chấm loại đó là có lợi thế cho mã này, chung hoặc trong phiên đang chạy.</p>",
  },
  {
    id: "flows", group: "Thị trường", term: "Dòng tiền ETF và stablecoin",
    short: "Tiền vào/ra ròng mỗi ngày của các quỹ ETF Bitcoin/Ethereum giao ngay ở Mỹ (Farside), và tổng stablecoin đang lưu hành (DefiLlama). Số cuối ngày.",
    body: "<p><b>ETF</b>: tiền vào ròng là tổ chức Mỹ đang mua coin thật qua quỹ (IBIT, FBTC…). Nhiều phiên liên tiếp cùng chiều quan trọng hơn một phiên lớn.</p><p><b>Stablecoin</b>: tổng USDT, USDC… tăng là tiền mới vào hệ crypto, là nhiên liệu cho giá; giảm là tiền rút ra.</p><p>Nguồn miễn phí, có thể đổi định dạng hoặc chặn; nếu lỗi, app giữ số cũ và ghi rõ là số cũ.</p>",
  },
  {
    id: "opt-flow", group: "Phái sinh", term: "Dòng lệnh quyền chọn lớn",
    short: "BTC/ETH: các lệnh quyền chọn khớp trên Deribit có phí từ $100K (ETH $50K), ai mua hay bán chủ động, call hay put, có phải lệnh khối của tổ chức không. Tài sản Mỹ: hợp đồng có khối lượng hôm nay lớn nhất, đánh dấu ⚑ khi khối lượng vượt hợp đồng mở.",
    body: "<p>Thanh màu trên cùng so phí bảo hiểm của lệnh nghiêng tăng (mua call, bán put) với lệnh nghiêng giảm hoặc phòng hộ (mua put, bán call). Phía của lệnh là phía chủ động: người chấp nhận giá ngay. <b>Lệnh khối</b> là giao dịch thoả thuận riêng giữa các tổ chức rồi báo lên sàn, thường là quỹ.</p><p>Với tài sản Mỹ không có dữ liệu từng lệnh miễn phí, nên dùng khối lượng trong ngày: khối lượng lớn hơn OI nghĩa là có người mở vị thế mới lớn ở hợp đồng đó.</p>",
  },
  {
    id: "inst-crypto", group: "Phái sinh", term: "Chỉ số tổ chức theo dõi: crypto",
    short: "Bảng gom OI, funding 3 sàn, tỷ lệ long của top trader và của đám đông, mua/bán chủ động, chênh giá Coinbase, put/call và DVOL cho BTC, ETH, SOL. Dữ liệu trực tiếp, làm mới mỗi 2 phút.",
    body: "<p><b>Cách đọc nhanh</b>: funding cao (đỏ) cùng đám đông long trên 60% là thị trường chật long, dễ bị quét xuống. Funding âm (xanh) cùng đám đông short là dễ bị ép mua lại. Top trader là tiền lớn: khi top trader và đám đông ngược chiều nhau, thường nên theo top trader.</p><p><b>Chênh giá Coinbase</b> dương nghĩa là tổ chức Mỹ đang mua mạnh hơn phần còn lại. <b>OI</b> tăng cùng giá là tiền mới vào theo xu hướng; OI giảm khi giá tăng là short đóng lệnh, đà kém bền.</p><p>Nguồn: API công khai của Binance Futures, Bybit, OKX, Coinbase, Deribit.</p>",
  },
  {
    id: "inst-vol", group: "Biến động", term: "VIX, cấu trúc kỳ hạn và các chỉ số biến động",
    short: "VIX đo nỗi sợ trên S&P 500. So VIX 9 ngày, 30 ngày, 3 tháng, 6 tháng cho biết thị trường lo ngắn hạn hay dài hạn. VVIX, SKEW, MOVE, VXN, GVZ, OVX là biến động của VIX, rủi ro đuôi, trái phiếu, Nasdaq, vàng, dầu. Trễ khoảng 15 phút.",
    body: "<p><b>Cấu trúc kỳ hạn</b>: bình thường VIX ngắn hạn thấp hơn dài hạn (contango, đường xanh). Khi ngắn hạn vượt dài hạn (đảo ngược, đường đỏ), thị trường đang hoảng loạn; những lúc tỷ lệ VIX/VIX3M rất cao thường gần đáy ngắn hạn của chứng khoán.</p><p><b>Rank 1 năm</b> là vị trí của giá trị hiện tại trong khoảng thấp nhất - cao nhất 1 năm. VIX trên 30 là vùng sợ hãi, dưới 14 là vùng chủ quan.</p><p><b>Put/call CBOE</b> của SPX, SPY, QQQ: trên 1 là đang mua bảo hiểm nhiều.</p><p>Nguồn: Yahoo Finance (chỉ số CBOE), trễ khoảng 15 phút trong giờ Mỹ; ngoài giờ là giá đóng cửa.</p>",
  },
  {
    id: "cot", group: "Thị trường", term: "COT của CFTC",
    short: "Báo cáo hằng tuần của Ủy ban giao dịch hàng hoá tương lai Mỹ: đầu cơ lớn (quỹ, CTA) và bên phòng hộ (nhà sản xuất, ngân hàng) đang long hay short bao nhiêu hợp đồng trên vàng, dầu, chỉ số, trái phiếu, tiền tệ, Bitcoin CME, nông sản.",
    body: "<p><b>Đầu cơ ròng</b> = long trừ short của nhóm non-commercial. <b>Chỉ số COT</b> đặt giá trị hiện tại trong khoảng 3 năm: 100 là long nhiều nhất 3 năm, 0 là short nhiều nhất. Vùng trên 90 hoặc dưới 10 là cực đoan, thường báo trước đảo chiều trung hạn chứ không phải điểm vào lệnh ngay.</p><p><b>Bên phòng hộ</b> thường đi ngược giá: họ mua khi giá thấp, bán khi giá cao, nên COT phòng hộ cao là vùng giá tốt.</p><p><b>Độ trễ</b>: CFTC chốt vị thế thứ Ba, công bố chiều thứ Sáu giờ Mỹ (sáng thứ Bảy giờ Việt Nam). Đường nhỏ là vị thế ròng đầu cơ 3 năm.</p>",
  },
  {
    id: "gex", group: "Phái sinh", term: "GEX (gamma exposure) theo strike",
    short: "Ở mỗi mức strike, nhà tạo lập quyền chọn phải mua hoặc bán bao nhiêu USD tài sản cơ sở khi giá đi 1% để giữ vị thế trung lập.",
    body: "<p>Người bán quyền chọn (nhà tạo lập, dealer) luôn phòng hộ bằng cách mua/bán tài sản cơ sở. Gamma cho biết lượng phòng hộ đó thay đổi nhanh cỡ nào khi giá chạy. GEX = gamma × số hợp đồng mở (OI) × hệ số hợp đồng × giá² × 1%.</p><p><b>Quy ước</b>: dealer thường mua call của nhà đầu tư và bán put cho họ, nên GEX của call tính dương (xanh, bên phải), của put tính âm (đỏ, bên trái). Vạch cam là GEX ròng ở strike đó.</p><p><b>Tường call</b> là strike trên giá có GEX call lớn nhất, thường đóng vai kháng cự vì dealer bán ra khi giá tiến lại gần. <b>Tường put</b> là strike dưới giá có GEX put lớn nhất, thường là hỗ trợ, nhưng nếu bị phá thì giá dễ rơi nhanh.</p><p>Nút <b>OI</b> chuyển sang số hợp đồng đang mở theo strike. Chọn khoảng hạn (≤ 7 ngày, ≤ 30 ngày…) hoặc một hạn cụ thể ở thanh trên cùng. Rê chuột lên biểu đồ để xem số liệu từng strike.</p><p><b>Nguồn</b>: BTC/ETH lấy trực tiếp từ Deribit, sàn quyền chọn crypto lớn nhất. Chỉ số và ETF Mỹ lấy từ CBOE, chậm 15 phút, cập nhật mỗi 30 phút. Đây là ước tính theo quy ước phổ biến (như SpotGamma, SqueezeMetrics): vị thế thật của dealer không ai công bố.</p>"
  },
  {
    id: "gamma-flip", group: "Phái sinh", term: "Điểm lật gamma và GEX tổng",
    short: "Mức giá mà tổng GEX đổi dấu. Trên mức này thị trường thường êm và đi ngang; dưới mức này biến động dễ bị khuếch đại.",
    body: "<p>Biểu đồ \"GEX tổng theo giá\" tính lại toàn bộ GEX nếu giá nằm ở từng mức trong khoảng ±10%. Đoạn xanh là gamma dương, đoạn đỏ là gamma âm; chỗ chuyển màu là <b>điểm lật gamma</b>.</p><p><b>Gamma dương</b>: dealer bán khi giá lên, mua khi giá xuống, nên giá bị \"ghìm\", hợp với đánh hồi về trung bình và bán biên độ.</p><p><b>Gamma âm</b>: dealer phải mua đuổi khi giá lên, bán đuổi khi giá xuống, nên giá dễ chạy mạnh một chiều, hợp với đánh theo xu hướng và cần dừng lỗ chặt hơn.</p><p><b>Max pain</b> là giá đáo hạn khiến người mua quyền chọn mất nhiều nhất; gần ngày đáo hạn giá hay bị hút về quanh mức này.</p>"
  },
  {
    id: "iv-smile", group: "Phái sinh", term: "Nụ cười IV",
    short: "Độ biến động ngụ ý (IV) theo từng strike của mỗi hạn. Phía trái cao hơn phía phải nghĩa là thị trường trả giá đắt hơn để bảo hiểm giảm giá.",
    body: "<p>Mỗi đường là một hạn đáo hạn. Bên trái giá hiện tại dùng IV của put, bên phải dùng IV của call (lấy phía ngoài tiền vì thanh khoản tốt hơn).</p><p><b>Nghiêng trái</b> (put đắt hơn call): thị trường sợ giảm, thường thấy ở chứng khoán. <b>Nghiêng phải</b>: thị trường muốn đặt cược tăng, hay gặp ở crypto khi hưng phấn.</p><p>Đường của hạn gần thường nằm cao và cong hơn trước các sự kiện lớn (CPI, FOMC). Nếu hạn gần cao hơn hạn xa (đảo ngược), thị trường đang căng thẳng.</p>"
  },
  {
    id: "iv-surface", group: "Phái sinh", term: "Bề mặt IV 3D",
    short: "Ghép nụ cười IV của nhiều hạn thành một mặt 3 chiều: ngang là độ lệch strike so với giá, sâu là số ngày tới hạn, cao và màu là IV.",
    body: "<p>Màu xanh là IV thấp, đỏ là IV cao. Kéo chuột (hoặc kéo ngón tay) để xoay.</p><p>Mặt dốc lên ở phía các hạn gần nghĩa là thị trường đang lo một sự kiện sắp tới. Mặt dốc mạnh về phía strike thấp nghĩa là nhu cầu mua bảo hiểm giảm giá lớn.</p><p>Có thể dùng để chọn hạn và strike khi mua hoặc bán quyền chọn: mua ở vùng IV thấp (màu xanh), bán ở vùng IV cao (màu đỏ), và luôn so sánh với biến động thực tế.</p>"
  },
  {
    id: "tpo", group: "Hồ sơ khối lượng", term: "TPO (Market Profile)",
    short: "Mỗi phiên (mặc định một ngày theo giờ Việt Nam, đổi được sang ngày UTC hoặc phiên Mỹ) là một cột; mỗi 30 phút là một chữ cái A, B, C… đặt vào mọi mức giá đã chạm trong 30 phút đó. Mức nhiều chữ nhất là nơi thị trường chấp nhận lâu nhất.",
    body: "<p><b>Cách đọc</b>: chữ càng về sau càng chuyển màu từ xanh sang đỏ. Mức giá có nhiều chữ là nơi giá dừng lâu, tức là thị trường chấp nhận mức đó.</p><ul><li><b>POC</b> (tô cam): mức có nhiều chữ nhất trong phiên.</li><li><b>Vùng giá trị</b> (nền cam nhạt): 70% số chữ quanh POC. Giá mở cửa ngoài vùng giá trị phiên trước rồi quay vào lại thường chạy sang phía bên kia của vùng.</li><li><b>IB</b> (vạch xanh dương bên trái): biên độ của 2 chữ đầu tiên (1 giờ đầu phiên). Phá IB mạnh thường là ngày có xu hướng.</li><li><b>Chữ đơn lẻ</b> (vạch tím): giá đi qua rất nhanh, chỉ có 1 chữ. Đây là vùng mất cân bằng mà giá hay quay lại lấp.</li><li><b>Naked POC</b> (đường cam nét đứt kéo dài): POC phiên cũ mà giá chưa quay lại chạm. Chúng thường hút giá như nam châm.</li><li>▸ là giá mở phiên, ◂ là giá hiện tại hoặc giá đóng phiên.</li></ul><p>Thanh mờ phía sau các chữ là khối lượng tại mỗi mức giá. Lăn chuột để đổi độ cao tầng giá, Ctrl + lăn để giãn dòng, kéo để xem các phiên cũ. Dữ liệu dựng từ nến 5 phút của 7 ngày gần nhất.</p>"
  },
  {
    id: "paper-trading", group: "Công cụ", term: "Lệnh giả lập (paper trading)",
    short: "Tập đặt lệnh bằng tiền ảo 10.000 USDT trên dữ liệu thật. Lệnh, SL, TP hiện thành đường trên Bookmap và Footprint, kéo được để dời giá.",
    body: "<p>Khung <b>Lệnh giả lập</b> thu nhỏ sẵn ở thanh dưới cùng; bấm <b>▣ Lệnh giả lập</b> để mở. Không có lệnh nào gửi lên sàn: mọi thứ chỉ chạy trong trình duyệt.</p><ul><li><b>Market</b> khớp ngay theo sổ lệnh hiện tại. <b>Limit</b> xếp hàng sau khối lượng đang chờ ở mức giá đó và chỉ khớp khi lượng phía trước đã được khớp hết.</li><li><b>SL / TP</b>: giá chạm mức là đóng vị thế bằng lệnh market. Có thể nhập lúc đặt lệnh hoặc bấm Đặt SL / Đặt TP sau.</li><li>Trên biểu đồ: <b>kéo</b> đường lệnh chờ, SL, TP để dời giá; <b>bấm đúp</b> lên đường để huỷ; <b>Alt + bấm</b> lên biểu đồ để đặt nhanh lệnh limit (dưới giá là MUA, trên giá là BÁN) với khối lượng trong khung.</li><li>Nhãn SL/TP ghi luôn số USDT lãi/lỗ nếu giá chạm mức đó. Đường vàng nâu là giá thanh lý ước tính.</li></ul><p>Tài khoản giả lập được giữ lại cả khi đóng tab, giống nhật ký giao dịch. Bấm <b>Đặt lại</b> để về 10.000 USDT.</p>"
  },
  {
    id: "alerts", group: "Công cụ", term: "Cảnh báo",
    short: "Phát tiếng và hiện thông báo khi có lệnh lớn, tường bị rút, nghi iceberg, hoặc giá chạm mức bro đặt.",
    body: "<p>Mở nút <b>🔔</b> trên thanh menu để bật từng loại. Thông báo của trình duyệt cần bro cho phép một lần; khi tab đang mở thì có tiếng và dòng chữ ở góc dưới.</p><p>Cảnh báo giá: gõ mức giá rồi bấm Thêm. Khi giá đi qua mức đó, cảnh báo kêu một lần rồi tự xoá. Danh sách mức giá được lưu lại trên máy này.</p><p>Để tránh ồn, mỗi loại kêu tối đa một lần mỗi 5 giây.</p>"
  },
  {
    id: "algo-twap", group: "Order flow nâng cao", term: "Dấu vết lệnh chia đều (TWAP)",
    short: "Chuỗi lệnh cùng phía, cùng kích thước, cách nhau đều đặn: dấu vết của quỹ hoặc tổ chức đang mua/bán rải bằng thuật toán.",
    body: "<p>Tổ chức cần mua lượng lớn thường không đặt một lệnh mà chia nhỏ theo thời gian (TWAP) để không đẩy giá. Người thường không đặt lệnh đều như máy, nên chuỗi lệnh giống hệt nhau, nhịp đều là dấu vết rõ.</p><p><b>Điều kiện:</b> ít nhất 6 lệnh gốc cùng phía, cùng kích thước (3 chữ số có nghĩa), khoảng cách giữa các lệnh lệch không quá 30%. <b>Độ đều</b> 100% là cách nhau tuyệt đối đều.</p><p>Trên biểu đồ: hình thoi viền tím nối nét đứt. Tab \"Lệnh chia đều\" liệt kê tổng khối lượng, giá trị và giá đã đi thế nào trong lúc thuật toán chạy.</p><p><b>Giới hạn:</b> thuật toán đổi kích thước ngẫu nhiên thì không nhận ra được.</p>"
  },
  {
    id: "signal-score", group: "Order flow nâng cao", term: "Điểm tín hiệu tổng hợp (0–100)",
    short: "Gộp hấp thụ, hỗ trợ/kháng cự đã test, CVD phân kỳ và funding thành một điểm, rồi thống kê mỗi mức điểm đúng bao nhiêu phần trăm so với tỷ lệ nền.",
    body: "<p><b>Thành phần</b> (tối đa): hấp thụ 35 · chạm hỗ trợ/kháng cự đã test từ 2 lần 25 · CVD phân kỳ 25 · funding lệch về một phía 15. Điểm = tổng chia tổng tối đa có dữ liệu.</p><p><b>Đúng</b> = giá đi 1 ATR theo hướng tín hiệu trước khi đi ngược 1 ATR, trong 10 nến. <b>Tỷ lệ nền</b> = kết quả nếu vào ở mọi nến theo cùng luật. Một mức điểm chỉ đáng tin khi đúng nhiều hơn nền rõ ràng và có khoảng 100 lần trở lên.</p><p>Hỗ trợ/kháng cự trong điểm số chỉ dùng đỉnh/đáy đã xác nhận trước nến đó, nên thống kê không nhìn trước tương lai. Nhãn số trên biểu đồ hiện từ 60 điểm (đổi được trong tab).</p>"
  },
  {
    id: "fractal", group: "Fractal & kiểm chứng", term: "FRACTAL (tìm mẫu hình giống nhau)",
    short: "Tìm trong lịch sử những đoạn giá và khối lượng có hình giống lúc này, rồi xem sau đó giá đã đi đâu.",
    body: "<p>Thị trường lặp lại cấu trúc ở mọi cỡ: một cú giảm nhanh rồi hấp thụ trên khung 5 phút có thể giống hệt trên khung 1 giờ, chỉ khác cỡ. Đó là tính <b>fractal</b>.</p><p><b>Cách làm:</b> lấy L nến gần nhất (mặc định 24 nến), mô tả bằng hình dạng giá (đo bằng ATR), hình dạng khối lượng và delta mua bán chủ động. Rồi tìm K đoạn giống nhất trong lịch sử (mặc định 100), không chồng lên nhau, và chỉ lấy đoạn đã biết kết quả.</p><p><b>Cách đọc:</b> hình quạt cho thấy 100 lần giống trước đây, giá đi thế nào. Dải đậm là 50% trường hợp ở giữa, đường cam là trung vị. Bảng cho biết nếu vào LONG hoặc SHORT theo luật ATR thì thắng bao nhiêu phần trăm, kỳ vọng bao nhiêu R sau phí.</p><p><b>Lưu ý:</b> giống trong quá khứ không bảo đảm tương lai. Chỉ tin khi đủ mẫu và đã qua kiểm chứng ngoài mẫu.</p>"
  },
  {
    id: "fr-rule", group: "Fractal & kiểm chứng", term: "Luật thắng thua theo ATR",
    short: "Vào ở giá đóng cửa nến cuối, chốt lời khi giá đi có lợi tp × đơn vị, cắt lỗ khi đi ngược sl × đơn vị, tối đa thời gian giữ lệnh đã chọn. Đơn vị mặc định là dao động lúc giữ lệnh (ATR × √số nến).",
    body: "<p><b>ATR</b> (Average True Range) là biên độ dao động trung bình của một nến trong 14 nến gần nhất. Ví dụ BTC khung 5 phút ATR 120 USDT nghĩa là mỗi nến 5 phút thường dao động khoảng 120 USDT.</p><p><b>Đơn vị:</b> mặc định là <b>dao động lúc giữ lệnh</b> = ATR một nến × √(số nến giữ). Giữ 4 giờ trên khung 5 phút là 48 nến, √48 ≈ 6,9, nên 1 đơn vị ≈ 6,9 ATR 5 phút. Lý do: giá đi càng lâu thì dao động càng rộng, cỡ √thời gian lần. Nếu đặt chốt lời, cắt lỗ theo ATR một nến mà giữ lệnh 4 giờ thì quá sát, phí và nhiễu ăn hết. Chọn \"ATR một nến\" khi lướt rất nhanh.</p><p><b>Mặc định 1 : 1:</b> chốt lời 1 ATR, cắt lỗ 1 ATR. Cần thắng trên 50% (cộng thêm phí) mới có lãi.</p><p><b>Khi đổi:</b> chốt lời 2 ATR, cắt lỗ 1 ATR thì chỉ cần thắng khoảng 34% là hoà vốn, nhưng tỷ lệ thắng sẽ thấp hơn vì giá phải đi xa hơn. Cắt lỗ rộng hơn (1,5 hoặc 2 ATR) ít bị quét hơn nhưng mỗi lần thua mất nhiều hơn.</p><p><b>Thận trọng:</b> nếu một nến chạm cả chốt lời lẫn cắt lỗ, không biết cái nào trước, nên tính là thua. Hết thời gian giữ mà chưa chạm: tính theo giá lúc đó.</p><p><b>R</b> = số lần khoảng cắt lỗ. Thắng 2 ATR với cắt lỗ 1 ATR là +2R, thua là −1R.</p>"
  },
  {
    id: "fr-sample", group: "Fractal & kiểm chứng", term: "Bao nhiêu mẫu thì tin được?",
    short: "Dưới 30 mẫu: chưa nói được gì. 30 đến 99: sơ bộ. Từ 100: đủ tin theo thông lệ. Từ 300: sai số còn khoảng ±5%.",
    body: "<p>Tỷ lệ thắng đo trên ít lần thì rất dễ sai vì may rủi. Ví dụ 6 thắng trên 10 lần (60%) nhưng khoảng tin cậy 95% là 31% đến 83%: thật ra có thể là thua.</p><p><b>Khoảng tin cậy 95% (Wilson):</b> phạm vi mà tỷ lệ thắng thật gần như chắc chắn nằm trong. Với 100 mẫu thắng 60%, khoảng là 50% đến 69%. Với 300 mẫu: 54% đến 65%.</p><p><b>Quy tắc Lai Long dùng:</b> chỉ gọi là <b>có lợi thế</b> khi có ít nhất 30 mẫu và <b>cận dưới</b> khoảng tin cậy 95% của kỳ vọng R mỗi lệnh (đã trừ phí) vẫn dương. Ví dụ kỳ vọng +0,15R với khoảng −0,05 đến +0,35 thì chưa đủ; +0,25R với khoảng +0,05 đến +0,45 thì đủ. Đây là cách các nhà giao dịch định lượng tránh tự lừa mình.</p>"
  },
  {
    id: "fr-oos", group: "Fractal & kiểm chứng", term: "Kiểm chứng ngoài mẫu (walk-forward)",
    short: "Thử phương pháp trên đoạn dữ liệu nó chưa từng thấy: 70% đầu làm thư viện, 30% sau để thử như giao dịch thật.",
    body: "<p>Tìm quy luật trên một đoạn dữ liệu rồi chấm điểm trên chính đoạn đó thì luôn đẹp (gọi là quá khớp). Cách đúng là chấm trên đoạn chưa thấy.</p><p><b>Cách làm:</b> trên 30% dữ liệu cuối, tại mỗi điểm thử (cách nhau đúng thời gian giữ lệnh để các lệnh không chồng nhau), chỉ tìm mẫu trong quá khứ của điểm đó. Nếu mẫu cho thấy LONG hoặc SHORT có kỳ vọng dương thì vào lệnh, không thì đứng ngoài. Rồi ghi kết quả thật.</p><p><b>So sánh:</b> với việc vào LONG hoặc SHORT ở mọi điểm thử (không chọn lọc). Phương pháp chỉ có giá trị khi kết quả tốt hơn rõ ràng và cận dưới tỷ lệ thắng vẫn trên mức hoà vốn.</p>"
  },
  {
    id: "fr-context", group: "Fractal & kiểm chứng", term: "Bối cảnh khung lớn (H1, H4)",
    short: "Chỉ so với những lần có cùng xu hướng H1 và cùng vị trí giá trong biên độ H4, đúng cách bạn đọc đa khung.",
    body: "<p><b>Xu hướng H1:</b> tăng khi EMA20 cao hơn EMA50 trên nến 1 giờ quá 0,3 ATR, giảm khi thấp hơn, còn lại là đi ngang.</p><p><b>Vị trí trong biên độ H4:</b> giá đang ở một phần ba dưới (đáy), giữa hay trên (đỉnh) của vùng cao nhất, thấp nhất 30 nến 4 giờ gần nhất (khoảng 5 ngày).</p><p>Cùng một hình 5 phút nhưng ở đáy biên độ trong xu hướng tăng thường khác hẳn ở đỉnh biên độ trong xu hướng giảm. Bật lọc này thì mẫu ít hơn nhưng sát bối cảnh hơn.</p><p>Chỉ dùng nến H1, H4 đã đóng cửa, không nhìn trước.</p>"
  },
  {
    id: "fr-equity", group: "Fractal & kiểm chứng", term: "Ba kịch bản và đường cong vốn",
    short: "Nếu mỗi lần gặp hình này trong lịch sử bạn đều vào LONG (hoặc SHORT) theo đúng luật, tài khoản sẽ đi thế nào.",
    body: "<p>Các mẫu giống nhau được xếp theo thời gian. Mỗi mẫu là một lệnh theo luật đang chọn (chốt lời, cắt lỗ, thời gian giữ, đã trừ phí và trượt giá). Đường cong cộng dồn kết quả từng lệnh.</p><p><b>WR</b> (tỷ lệ thắng): phần trăm lệnh có lãi sau phí, kể cả lệnh hết giờ mà vẫn lãi.</p><p><b>PF</b> (profit factor): tổng R của các lệnh lãi chia tổng R của các lệnh lỗ. Trên 1 là có lãi, từ 1,5 trở lên là tốt.</p><p><b>Tổng R</b>: cộng tất cả lệnh. Với rủi ro 1% mỗi lệnh, +10R xấp xỉ +10% vốn (trang tính lãi kép chính xác).</p><p><b>Sụt giảm tối đa (drawdown)</b>: từ đỉnh cao nhất của tài khoản xuống đáy thấp nhất sau đó, tính bằng R và bằng % vốn. Đây là mức đau nhất bạn phải chịu được nếu đi theo kịch bản đó.</p><p><b>Chuỗi thua dài nhất</b>: số lệnh lỗ liên tiếp nhiều nhất.</p><p><b>Đường 0</b>: kịch bản nào nằm dưới đường này thì không vào lệnh còn tốt hơn.</p><p><b>Lưu ý:</b> đây là kết quả trên các lần giống trong quá khứ, chưa phải kiểm chứng ngoài mẫu. Phần \"Đường cong vốn ngoài mẫu\" mới là bài thử thật.</p>"
  },
  {
    id: "fr-cost", group: "Fractal & kiểm chứng", term: "Phí và trượt giá trong kiểm chứng",
    short: "Mỗi lệnh trừ 2 lần phí taker và 2 lần trượt giá (vào và ra), quy ra R. Tín hiệu đúng 55% vẫn có thể lỗ sau phí.",
    body: "<p>Ví dụ BTC 65.000, ATR 5 phút 120 USDT, phí taker 0,05% và trượt giá 2 bps mỗi chiều: chi phí khứ hồi khoảng 0,14% × 65.000 = 91 USDT, tức gần 0,76 ATR. Với cắt lỗ 1 ATR thì mỗi lệnh mất sẵn 0,76R.</p><p>Vì vậy trên khung nhỏ, phí rất nặng. Chốt lời xa hơn (2 hoặc 3 ATR) hoặc khung lớn hơn giúp phí nhỏ đi so với lợi nhuận.</p>"
  },
  {
    id: "radar", group: "Radar", term: "Radar: giá và khối lượng theo bối cảnh",
    short: "Không hỏi phe nào thắng phe nào. Radar hỏi: thị trường đang phản ứng thế nào, phản ứng đó chính thức hay tạm thời, và trong quá khứ những lần giống vậy đã kết thúc ra sao.",
    body: "<p>Chỉ dùng giá và khối lượng, như Wyckoff, nhưng đo bằng máy. Nến 1 giờ, khoảng 3 tuần.</p><p><b>Khối lượng bất thường</b> luôn xét theo bối cảnh. Thứ nhất, so với <b>cùng giờ trong ngày</b> của tối đa 14 ngày trước: giờ Mỹ mở cửa ngày nào cũng đông thì không tính là bất thường. Thứ hai, so với <b>nhịp 3 ngày trước đó</b>: <b>nhàm chán</b> (khối lượng và biên độ đều dưới 85% bình thường), <b>hưng phấn</b> hoặc <b>hoảng loạn</b> (giá đi một chiều, hiệu suất đường đi trên 30%, khối lượng hoặc biên độ trên 115%), còn lại là <b>bình thường</b>.</p><p><b>Các loại sự kiện</b>: <b>Đánh thức</b> (Đ): khối lượng ×3 giữa lúc nhàm chán. <b>Cao trào</b> (C): khối lượng ×3 lúc hưng phấn/hoảng loạn. <b>Khối lượng lớn</b> (K): ×3 lúc bình thường. <b>Nỗ lực không kết quả</b> (H): ×2,5 mà nến hẹp dưới 0,7 ATR, có người hấp thụ. <b>Kết quả không nỗ lực</b> (T): nến dài trên 2 ATR mà khối lượng không cao, giá trượt trong vùng trống. <b>Nghịch lý</b> (N): bên chủ động áp đảo từ 60/40 mà nến đi ngược lại. <b>Cạn khối lượng</b>: đang hưng phấn/hoảng loạn, giá vẫn sát đỉnh/đáy nhưng 6 giờ qua khối lượng dưới 60% bình thường.</p><p><b>Mức giá</b> của sự kiện là giá trung bình theo khối lượng của cây nến đó (VWAP của giờ đó), tức là nơi lượng tiền bất thường thực sự khớp. Trên biểu đồ, mức của sự kiện 72 giờ gần nhất được kéo tới hiện tại.</p><p>Các ngưỡng trên là mặc định ban đầu; thống kê lịch sử cho biết ngưỡng nào thật sự có ý nghĩa.</p>"
  },
  {
    id: "radar-react", group: "Radar", term: "Phản ứng: chính thức hay tạm thời",
    short: "Sau sự kiện, nếu giá đi thêm 1 ATR theo hướng đó trước khi quay ngược qua mức giá thì là chính thức; quay ngược qua mức quá 0,5 ATR trước thì là tạm thời (thị trường bác bỏ).",
    body: "<p><b>Hướng</b> của sự kiện: theo bên chủ động áp đảo (mua/bán chủ động), không có thì theo màu nến; với cao trào và cạn khối lượng là hướng của xu hướng 3 ngày.</p><p><b>Chính thức</b>: giá đi thêm 1 ATR theo hướng sự kiện trước khi có nến đóng cửa ngược qua mức giá quá 0,5 ATR. <b>Tạm thời</b>: điều ngược lại xảy ra trước. <b>Giằng co</b>: 24 giờ chưa ra kết quả. <b>Đang chờ</b>: chưa đủ 24 giờ.</p><p>Với <b>nghịch lý</b>, hướng là hướng của bên chủ động; nếu sau đó \"tạm thời\" nghĩa là bên hấp thụ đã thắng, nếu \"chính thức\" nghĩa là nghịch lý tự điều chỉnh về phía bên chủ động.</p><p>Cột <b>Sau 12h</b>: giá thay đổi sau 12 giờ theo hướng sự kiện, đơn vị ATR lúc xảy ra (dương là đi đúng hướng).</p>"
  },
  {
    id: "radar-history", group: "Radar", term: "Lặp lại trong lịch sử",
    short: "Mỗi loại sự kiện đã xảy ra bao nhiêu lần, bao nhiêu % thành chính thức, bao lâu thì ra kết quả, và sau 4, 12, 24 giờ giá thường đi bao xa.",
    body: "<p>Chọn <b>mã đang xem</b> hoặc <b>Cả rổ</b> (gộp mọi tài sản trong máy quét, nhiều mẫu hơn nhưng trộn các thị trường khác nhau). <b>Ra kết quả sau</b>: số giờ trung vị tới khi chính thức / tạm thời.</p><p>Các cột TB là thay đổi giá trung bình theo hướng sự kiện, đơn vị ATR, để so được giữa các tài sản có biên độ khác nhau. <b>Đúng hướng 12h</b>: tỷ lệ lần giá đi đúng hướng sau 12 giờ.</p><p>Dòng mờ là dưới 20 lần có kết quả: chưa đủ để tin. Dữ liệu chỉ khoảng 3 tuần nên đây là gợi ý để đào sâu; kiểm chứng đầy đủ cần kho dữ liệu dài hơn.</p>"
  },
  {
    id: "radar-fuel", group: "Radar", term: "Nhiên liệu đòn bẩy",
    short: "Đòn bẩy đang dồn ở đâu: OI, funding, tỷ lệ tài khoản long, top trader, dòng tiền spot và perp, Coinbase premium. Chỉ có cho crypto.",
    body: "<p>Theo lý thuyết phản thân của Soros, giá đi kéo theo người đến sau, người đến sau lại đẩy giá đi tiếp, cho tới khi hết người để kéo vào thì vòng lặp đảo chiều. Phần này đo lượng \"nhiên liệu\" còn lại.</p><p><b>OI 4 góc</b> (4 giờ): giá lên OI lên là long mới mở; giá lên OI giảm là short đóng; giá giảm OI lên là short mới mở; giá giảm OI giảm là long xả.</p><p>Mỗi phép đo kèm <b>z-score</b> so với 7 ngày trước đó; ô đậm là từ ±2. Funding và tỷ lệ long lệch mạnh trong khi khối lượng cạn là dấu hiệu nhiên liệu sắp hết. Hợp đồng tương lai không có số này theo giờ (báo cáo COT chậm 3 ngày).</p>"
  },
  {
    id: "radar-mtf", group: "Radar", term: "Radar đa khung",
    short: "Cùng một tài sản trên 5 khung (5m, 15m, 1h, 4h, 1D): bối cảnh của từng khung, khối lượng nến vừa đóng, và sự kiện gần nhất.",
    body: "<p>Mỗi khung có nhịp riêng: bối cảnh 5m nhìn 6 giờ trước đó, 15m nhìn 1 ngày, 1h nhìn 3 ngày, 4h nhìn 7 ngày, 1D nhìn 20 ngày. Khối lượng luôn so với cùng thời điểm trong ngày của các ngày trước (khung ngày thì so với 14 ngày trước).</p><p><b>Cách dùng</b>: khung nhỏ báo sớm nhưng nhiễu. Khi khung nhỏ có sự kiện ở một mức giá và khung lớn hơn cũng có sự kiện cùng hướng quanh mức đó, tín hiệu đáng tin hơn. Bấm một dòng để xem biểu đồ, sự kiện và thống kê của khung đó.</p><p>Hợp đồng tương lai: Yahoo không có nến 4 giờ nên được gộp từ nến 1 giờ theo mốc UTC.</p>"
  },
  {
    id: "radar-together", group: "Radar", term: "Đồng loạt",
    short: "Những giờ mà từ 3 tài sản trở lên (crypto và hợp đồng tương lai) cùng có sự kiện Radar. Thường là tin vĩ mô hoặc dòng tiền lớn dịch chuyển giữa các thị trường.",
    body: "<p>Ví dụ vàng, yên và S&amp;P 500 cùng có khối lượng bất thường trong một giờ: có thể là tin, có thể là ngân hàng trung ương can thiệp, có thể là một quỹ lớn đổi vị thế. Cột hướng đếm số tài sản đi lên và đi xuống; rê chuột lên tên để xem loại sự kiện và phản ứng.</p><p>Dùng khung 1h của máy quét, khoảng 3 tuần gần nhất.</p>"
  },
  {
    id: "radar-scan", group: "Radar", term: "Máy quét sự kiện",
    short: "Mọi sự kiện 48 giờ qua trên 12 mã crypto và 10 hợp đồng tương lai, mới nhất ở trên, kèm mức giá, giá đang cách bao xa, phản ứng và lịch sử của loại đó trên cả rổ.",
    body: "<p>Hợp đồng tương lai (vàng, bạc, dầu, khí, đồng, yên, euro, S&P 500, Nasdaq, trái phiếu 10 năm) lấy nến 1 giờ từ Yahoo, chậm khoảng 15 phút, và chỉ có trên bản chạy ở laptop. Không có số mua/bán chủ động nên không có sự kiện nghịch lý.</p><p>Bấm một dòng để mở tài sản đó. Tự quét lại mỗi 5 phút khi đang mở tab.</p>"
  },
];

export const GROUPS = ["Radar", "Fractal & kiểm chứng", "Order flow nâng cao", "Bookmap", "Footprint", "Dòng lệnh", "Thanh lý", "Hỗ trợ / kháng cự", "Xu hướng & động lượng", "Biến động", "Hồ sơ khối lượng", "Backtest", "Phái sinh", "Thị trường", "Công cụ"];
