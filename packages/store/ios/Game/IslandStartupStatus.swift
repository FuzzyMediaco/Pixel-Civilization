import UIKit

/// Available before WebKit or the device save database has started.
final class IslandStartupStatus: UIView {
    private let message = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isAccessibilityElement = true
        accessibilityIdentifier = "island-startup-status"
        backgroundColor = UIColor(red: 0.985, green: 0.979, blue: 0.947, alpha: 1)
        layer.cornerRadius = 18
        layer.borderWidth = 1
        layer.borderColor = UIColor(red: 0.66, green: 0.73, blue: 0.68, alpha: 1).cgColor
        let ink = UIColor(red: 0.12, green: 0.26, blue: 0.22, alpha: 1)
        spinner.color = ink
        message.textColor = ink
        let baseFont = UIFont(name: "DMSans9pt-Regular", size: 17) ?? UIFont.preferredFont(forTextStyle: .body)
        message.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: baseFont)
        message.adjustsFontForContentSizeCategory = true
        message.numberOfLines = 0
        let row = UIStackView(arrangedSubviews: [spinner, message])
        row.alignment = .center
        row.spacing = 10
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
        show(reopening: false)
    }

    required init?(coder: NSCoder) { return nil }

    func show(reopening: Bool) {
        message.text = reopening ? "Reopening your island…" : "Opening your island…"
        accessibilityLabel = message.text
        isHidden = false
        spinner.startAnimating()
    }

    func finish() {
        spinner.stopAnimating()
        isHidden = true
    }
}
