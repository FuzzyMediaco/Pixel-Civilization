import Foundation
import CoreGraphics
import ImageIO

// Ignore the system status bar and home indicator. A framebuffer filled with
// only the launch background can still have a populated accessibility tree.
let input = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
      image.width > 1200, image.height > 2000 else { exit(1) }

let width = 64, height = 88
var pixels = [UInt8](repeating: 0, count: width * height * 4)
let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
    guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                                  bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return false }
    context.interpolationQuality = .medium
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return true
}
guard rendered else { exit(1) }
var colors = Set<UInt32>()
for y in 9..<(height - 9) {
    for x in 2..<(width - 2) {
        let i = (y * width + x) * 4
        let r = UInt32(pixels[i] >> 3), g = UInt32(pixels[i + 1] >> 3), b = UInt32(pixels[i + 2] >> 3)
        colors.insert((r << 10) | (g << 5) | b)
    }
}
print("Captured \(image.width) × \(image.height) with \(colors.count) scene colors")
exit(colors.count >= 40 ? 0 : 1)

