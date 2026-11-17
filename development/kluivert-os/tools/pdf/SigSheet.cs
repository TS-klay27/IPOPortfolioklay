using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class SigSheet {
    // rows: each = {bmpPath, jpgPath, cx, cy, label}; renders ORIGINAL | OPTIMIZED at 100% of the original pixels.
    public static void Make(string[][] rows, string png, int cw, int ch) {
        int W = cw * 2 + 30, H = rows.Length * (ch + 30) + 10;
        using (var sheet = new Bitmap(W, H))
        using (var g = Graphics.FromImage(sheet))
        using (var f = new Font("Segoe UI", 11, FontStyle.Bold))
        using (var br = new SolidBrush(Color.Black)) {
            g.Clear(Color.FromArgb(225, 229, 232));
            int y = 6;
            foreach (var r in rows) {
                using (var o = new Bitmap(r[0]))
                using (var jr = new Bitmap(r[1]))
                using (var j = new Bitmap(o.Width, o.Height)) {
                    using (var gj = Graphics.FromImage(j)) { gj.InterpolationMode = InterpolationMode.HighQualityBicubic; gj.PixelOffsetMode = PixelOffsetMode.HighQuality; gj.DrawImage(jr, 0, 0, o.Width, o.Height); }
                    int cx = int.Parse(r[2]), cy = int.Parse(r[3]);
                    var rc = new Rectangle(Math.Max(0, Math.Min(o.Width - cw, cx - cw / 2)), Math.Max(0, Math.Min(o.Height - ch, cy - ch / 2)), cw, ch);
                    g.DrawString(r[4] + "  (original | optimized, 100%)", f, br, 10, y);
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.DrawImage(o, new Rectangle(10, y + 20, cw, ch), rc, GraphicsUnit.Pixel);
                    g.DrawImage(j, new Rectangle(cw + 20, y + 20, cw, ch), rc, GraphicsUnit.Pixel);
                }
                y += ch + 30;
            }
            sheet.Save(png, ImageFormat.Png);
        }
    }
}
