using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;

public static class ImgTool {
    static ImageCodecInfo Jpeg() { return ImageCodecInfo.GetImageEncoders().First(c => c.MimeType == "image/jpeg"); }

    static Bitmap Resize(Image src, int w, int h) {
        var dst = new Bitmap(w, h, PixelFormat.Format24bppRgb);
        dst.SetResolution(src.HorizontalResolution, src.VerticalResolution);
        using (var g = Graphics.FromImage(dst)) {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.SmoothingMode = SmoothingMode.HighQuality;
            using (var ia = new ImageAttributes()) {
                ia.SetWrapMode(WrapMode.TileFlipXY); // no dark fringe on the borders
                g.DrawImage(src, new Rectangle(0, 0, w, h), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, ia);
            }
        }
        return dst;
    }

    // Resize the original and save as baseline JPEG at the given quality (4:2:0 chroma, as GDI+ does).
    public static long MakeJpeg(string bmp, string jpg, int w, int h, long quality) {
        using (var src = new Bitmap(bmp)) {
            Bitmap img = (w == src.Width && h == src.Height) ? new Bitmap(src) : Resize(src, w, h);
            using (img) {
                var ep = new EncoderParameters(1);
                ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
                img.Save(jpg, Jpeg(), ep);
            }
        }
        return new System.IO.FileInfo(jpg).Length;
    }

    static byte[] Pixels(Bitmap b, out int stride) {
        var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
        stride = d.Stride; var buf = new byte[stride * b.Height];
        Marshal.Copy(d.Scan0, buf, 0, buf.Length); b.UnlockBits(d); return buf;
    }

    // PSNR of the luminance after scaling the JPEG back to the original size,
    // compared with the original resampled down-and-up the same way (isolates JPEG + resample loss).
    // Returns {psnrY, maxBlockErr} where maxBlockErr = worst mean abs error over 16x16 blocks (local damage).
    public static double[] Compare(string bmp, string jpg) {
        using (var o = new Bitmap(bmp))
        using (var jRaw = new Bitmap(jpg))
        using (var j = Resize(jRaw, o.Width, o.Height))
        using (var o24 = o.Clone(new Rectangle(0, 0, o.Width, o.Height), PixelFormat.Format24bppRgb)) {
            int s1, s2; var a = Pixels(o24, out s1); var c = Pixels(j, out s2);
            int W = o.Width, H = o.Height; double se = 0; long n = 0;
            int bw = (W + 15) / 16, bh = (H + 15) / 16; var blk = new double[bw * bh]; var cnt = new int[bw * bh];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
                int i = y * s1 + x * 3, k = y * s2 + x * 3;
                double ya = .114 * a[i] + .587 * a[i + 1] + .299 * a[i + 2];
                double yc = .114 * c[k] + .587 * c[k + 1] + .299 * c[k + 2];
                double e = ya - yc; se += e * e; n++;
                int bi = (y / 16) * bw + x / 16; blk[bi] += Math.Abs(e); cnt[bi]++;
            }
            double mse = se / n, psnr = mse == 0 ? 99 : 10 * Math.Log10(255.0 * 255.0 / mse);
            double worst = 0; for (int i = 0; i < blk.Length; i++) if (cnt[i] > 0) worst = Math.Max(worst, blk[i] / cnt[i]);
            return new double[] { psnr, worst };
        }
    }

    // Side-by-side at 100% (1 image pixel = 1 screen pixel of the ORIGINAL): full page thumbnails + 2 detail crops.
    public static void Sheet(string bmp, string jpg, string png, int cx1, int cy1, int cx2, int cy2, int crop) {
        using (var o = new Bitmap(bmp))
        using (var jRaw = new Bitmap(jpg))
        using (var j = Resize(jRaw, o.Width, o.Height)) {
            int thumbH = 640, thumbW = (int)Math.Round(o.Width * (double)thumbH / o.Height);
            int W = Math.Max(thumbW * 2 + 30, crop * 2 + 30), H = 40 + thumbH + 2 * (crop + 40) + 20;
            using (var sheet = new Bitmap(W, H))
            using (var g = Graphics.FromImage(sheet))
            using (var f = new Font("Segoe UI", 13, FontStyle.Bold))
            using (var br = new SolidBrush(Color.FromArgb(20, 20, 20))) {
                g.Clear(Color.FromArgb(235, 238, 240)); g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawString("ORIGINAL", f, br, 10, 10); g.DrawString("OPTIMIZED", f, br, thumbW + 30, 10);
                g.DrawImage(o, new Rectangle(10, 40, thumbW, thumbH)); g.DrawImage(j, new Rectangle(thumbW + 20, 40, thumbW, thumbH));
                int y = 40 + thumbH + 20; int[][] cs = { new[] { cx1, cy1 }, new[] { cx2, cy2 } };
                foreach (var p in cs) {
                    var r = new Rectangle(Math.Max(0, Math.Min(o.Width - crop, p[0] - crop / 2)), Math.Max(0, Math.Min(o.Height - crop, p[1] - crop / 2)), crop, crop);
                    g.DrawString("100% crop @ " + r.X + "," + r.Y, f, br, 10, y);
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.DrawImage(o, new Rectangle(10, y + 24, crop, crop), r, GraphicsUnit.Pixel);
                    g.DrawImage(j, new Rectangle(crop + 20, y + 24, crop, crop), r, GraphicsUnit.Pixel);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    y += crop + 40;
                }
                sheet.Save(png, ImageFormat.Png);
            }
        }
    }
}
