import Foundation
import XCTest
@testable import CompanionCore

private final class ConnectionTransportStub: URLProtocol {
    enum Result {
        case success
        case status(Int)
        case failure(URLError.Code)
    }

    static var result: Result = .success
    static var capturedRequest: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.capturedRequest = request
        switch Self.result {
        case .success:
            respond(status: 200, body: Data("{}".utf8))
        case let .status(code):
            respond(status: code, body: Data("{\"error\":\"pair this device again\"}".utf8))
        case let .failure(code):
            client?.urlProtocol(self, didFailWithError: URLError(code))
        }
    }

    override func stopLoading() {}

    private func respond(status: Int, body: Data) {
        let response = HTTPURLResponse(
            url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
}

final class ConnectionTransportTests: XCTestCase {
    private var session: URLSession!
    private var client: CompanionClient!

    override func setUp() {
        super.setUp()
        ConnectionTransportStub.result = .success
        ConnectionTransportStub.capturedRequest = nil
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ConnectionTransportStub.self]
        session = URLSession(configuration: configuration)
        client = CompanionClient(
            connection: Connection(name: "Mac", host: "dead.tailnet.ts.net", port: 8810),
            token: "paired-token",
            session: session
        )
    }

    override func tearDown() {
        session.invalidateAndCancel()
        session = nil
        client = nil
        super.tearDown()
    }

    func testProbeIsAnAuthenticatedBoundedRead() async throws {
        try await client.connectionProbe()

        let request = try XCTUnwrap(ConnectionTransportStub.capturedRequest)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/config")
        XCTAssertEqual(request.timeoutInterval, 4)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer paired-token")
    }

    func testAddressFailureKeepsItsURLCodeForHostFailover() async throws {
        ConnectionTransportStub.result = .failure(.cannotFindHost)

        do {
            try await client.connectionProbe()
            XCTFail("expected the stale hostname to fail")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .cannotFindHost)
            XCTAssertTrue(ConnectionAdvice.shouldTryAnotherHost(error.code))
        } catch {
            XCTFail("expected URLError for failover, got \(error)")
        }
    }

    func testOfflineFailureDoesNotPretendAnotherHostWillHelp() async throws {
        ConnectionTransportStub.result = .failure(.notConnectedToInternet)

        do {
            try await client.connectionProbe()
            XCTFail("expected offline failure")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .notConnectedToInternet)
            XCTAssertFalse(ConnectionAdvice.shouldTryAnotherHost(error.code))
        }
    }

    func testUnauthorizedProbeRemainsAPairingFailure() async throws {
        ConnectionTransportStub.result = .status(401)

        do {
            try await client.connectionProbe()
            XCTFail("expected unauthorized failure")
        } catch let error as APIError {
            XCTAssertTrue(error.isUnauthorized)
            XCTAssertEqual(error.localizedDescription, "pair this device again")
        }
    }
}
