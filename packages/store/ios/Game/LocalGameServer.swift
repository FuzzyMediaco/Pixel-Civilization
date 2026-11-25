import Foundation
import NIOCore
import NIOHTTP1
import NIOPosix
import UniformTypeIdentifiers

/// A fixed, private loopback origin keeps WebKit's IndexedDB islands and Web Crypto
/// available across launches. The randomly issued cookie belongs to this WebView.
final class LocalGameServer {
    static let origin = URL(string: "http://127.0.0.1:42871")!
    let cookieValue = UUID().uuidString + UUID().uuidString
    private let group = MultiThreadedEventLoopGroup(numberOfThreads: 1)
    private var channel: Channel?
    private let remote = URLSession(configuration: .default, delegate: FirstPartyRedirects(), delegateQueue: nil)

    func start(_ completion: @escaping (Result<Void, Error>) -> Void) {
        guard let root = Bundle.main.url(forResource: "web", withExtension: nil) else {
            completion(.failure(CocoaError(.fileNoSuchFile))); return
        }
        let cookie = cookieValue
        let session = remote
        ServerBootstrap(group: group).serverChannelOption(ChannelOptions.backlog, value: 60)
            .serverChannelOption(ChannelOptions.socketOption(.so_reuseaddr), value: 1)
            .childChannelInitializer { channel in
                channel.pipeline.configureHTTPServerPipeline().flatMap {
                    channel.pipeline.addHandler(GameRequest(root: root, cookie: cookie, session: session))
                }
            }.bind(host: "127.0.0.1", port: 42871).whenComplete { result in
                if case .success(let channel) = result { self.channel = channel }
                DispatchQueue.main.async { completion(result.map { _ in () }) }
            }
    }
    deinit { channel?.close(promise: nil); group.shutdownGracefully { _ in }; remote.invalidateAndCancel() }
}

private final class FirstPartyRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

private final class GameRequest: ChannelInboundHandler {
    typealias InboundIn = HTTPServerRequestPart
    typealias OutboundOut = HTTPServerResponsePart
    let root: URL
    let cookie: String
    let session: URLSession
    var request: HTTPRequestHead?
    var body = Data()
    var rejected = false
    init(root: URL, cookie: String, session: URLSession) { self.root = root; self.cookie = cookie; self.session = session }
    func channelRead(context: ChannelHandlerContext, data: NIOAny) {
        switch unwrapInboundIn(data) {
        case .head(let head):
            request = head
            let token = "pixelLocal=" + cookie
            let cookies = head.headers["cookie"].flatMap { $0.split(separator: ";").map { $0.trimmingCharacters(in: .whitespaces) } }
            rejected = head.headers.first(name: "host") != "127.0.0.1:42871" || !cookies.contains(token)
        case .body(var chunk):
            if body.count + chunk.readableBytes > 20 * 1024 * 1024 { rejected = true }
            if !rejected, let bytes = chunk.readBytes(length: chunk.readableBytes) { body.append(contentsOf: bytes) }
        case .end:
            guard !rejected, let req = request, req.uri.hasPrefix("/"), !req.uri.hasPrefix("//"),
                  let url = URLComponents(string: req.uri), !url.path.contains(".."), !url.path.contains("\\") else {
                respond(context, .forbidden); return
            }
            if url.path.hasPrefix("/api/") {
                guard [.GET,.POST,.PUT,.DELETE,.PATCH,.HEAD].contains(req.method),
                      req.headers.first(name: "sec-fetch-site") != "cross-site",
                      req.headers.first(name: "origin").map({ $0 == LocalGameServer.origin.absoluteString }) ?? true else {
                    respond(context,.forbidden); return
                }
                var upstream = url
                upstream.scheme = "https"; upstream.host = "pixelcivilization.app"; upstream.port = nil
                guard let address = upstream.url else { respond(context,.badRequest); return }
                var outgoing = URLRequest(url: address)
                outgoing.httpMethod = req.method.rawValue
                outgoing.timeoutInterval = 60
                outgoing.setValue("https://pixelcivilization.app", forHTTPHeaderField: "Origin")
                for key in ["Content-Type","Accept","X-Game-Account","If-Match","Idempotency-Key","User-Agent","Accept-Language"] {
                    outgoing.setValue(req.headers.first(name: key), forHTTPHeaderField: key)
                }
                if !body.isEmpty { outgoing.httpBody = body }
                session.dataTask(with: outgoing) { bytes, response, _ in
                    context.eventLoop.execute {
                        guard let http = response as? HTTPURLResponse else {
                            self.respond(context,.serviceUnavailable); return
                        }
                        self.respond(context,HTTPResponseStatus(statusCode: http.statusCode),
                                     bytes ?? Data(),http.mimeType ?? "application/json")
                    }
                }.resume()
                return
            }
            guard req.method == .GET || req.method == .HEAD else { respond(context,.methodNotAllowed); return }
            var name = url.path == "/" ? "index.html" : String(url.path.dropFirst())
            if (name as NSString).pathExtension.isEmpty { name += ".html" }
            let file = root.appendingPathComponent(name).standardizedFileURL
            guard file.path.hasPrefix(root.standardizedFileURL.path + "/"), let bytes = try? Data(contentsOf:file,options:.mappedIfSafe) else {
                respond(context,.notFound); return
            }
            let webTypes = ["js":"text/javascript","mjs":"text/javascript","css":"text/css","html":"text/html",
                            "wasm":"application/wasm","webmanifest":"application/manifest+json","woff2":"font/woff2"]
            let type = webTypes[file.pathExtension] ?? UTType(filenameExtension:file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            respond(context,.ok,bytes,type,headOnly:req.method == .HEAD)
        }
    }
    private func respond(_ context: ChannelHandlerContext,_ status: HTTPResponseStatus,_ data: Data = Data(),_ mime: String = "text/plain",headOnly: Bool = false) {
        var headers = HTTPHeaders()
        headers.add(name:"Content-Type",value:mime); headers.add(name:"Content-Length",value:String(data.count))
        headers.add(name:"Cache-Control",value:"no-store"); headers.add(name:"Connection",value:"close")
        headers.add(name:"X-Content-Type-Options",value:"nosniff")
        headers.add(name:"X-Frame-Options",value:"SAMEORIGIN")
        context.write(wrapOutboundOut(.head(HTTPResponseHead(version:.http1_1,status:status,headers:headers))),promise:nil)
        if !headOnly && !data.isEmpty {
            var buffer = context.channel.allocator.buffer(capacity:data.count)
            buffer.writeBytes(data)
            context.write(wrapOutboundOut(.body(.byteBuffer(buffer))),promise:nil)
        }
        context.writeAndFlush(wrapOutboundOut(.end(nil))).whenComplete { _ in context.close(promise:nil) }
    }
}
