import Foundation
import XCTest
@testable import CompanionCore

private final class ProfileRequestStub: URLProtocol {
    static var responseBody = Data()
    static var capturedRequest: URLRequest?
    static var capturedBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.capturedRequest = request
        Self.capturedBody = Self.readBody(from: request)
        let response = HTTPURLResponse(
            url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseBody)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func readBody(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count >= 0 else { return nil }
            if count == 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}

final class ProfileClientTests: XCTestCase {
    private var session: URLSession!
    private var client: CompanionClient!

    override func setUp() {
        super.setUp()
        ProfileRequestStub.capturedRequest = nil
        ProfileRequestStub.capturedBody = nil
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ProfileRequestStub.self]
        session = URLSession(configuration: configuration)
        client = CompanionClient(
            connection: Connection(name: "Mac", host: "127.0.0.1", port: 8810),
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

    func testProfilePatchPreservesServerLimitsWithoutClientTruncation() throws {
        let name = String(repeating: "n", count: 100)
        let title = String(repeating: "t", count: 200)
        let description = String(repeating: "d", count: 4_000)
        let data = try JSONEncoder().encode(BotProfilePatch(
            name: name, title: title, description: description, voice: ""
        ))
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(body["name"] as? String, name)
        XCTAssertEqual(body["title"] as? String, title)
        XCTAssertEqual(body["description"] as? String, description)
        XCTAssertEqual(body["voice"] as? String, "", "empty explicitly selects the workspace default")
    }

    func testProfilePatchPersistsTheAuthoredLivingSpirit() throws {
        let data = try JSONEncoder().encode(BotProfilePatch(
            spirit: "watcher",
            spiritPalette: "oilchrome",
            spiritGeometry: "portal",
            spiritTemperament: "fierce"
        ))
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(body["spirit"] as? String, "watcher")
        XCTAssertEqual(body["spiritPalette"] as? String, "oilchrome")
        XCTAssertEqual(body["spiritGeometry"] as? String, "portal")
        XCTAssertEqual(body["spiritTemperament"] as? String, "fierce")
    }

    func testProfileClientSendsOnlyFieldsOwnedByTheAction() async throws {
        ProfileRequestStub.responseBody = Self.botResponse

        _ = try await client.updateProfile(
            botId: "avatar-bot",
            patch: BotProfilePatch(avatarCrop: .rounded)
        )

        _ = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        let data = try XCTUnwrap(ProfileRequestStub.capturedBody)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(body.keys.sorted(), ["avatarCrop"])
        XCTAssertEqual(body["avatarCrop"] as? String, "rounded")
    }

    func testCreateAgentSendsTheAuthoredLivingIdentity() async throws {
        ProfileRequestStub.responseBody = Self.botResponse

        _ = try await client.createBot(profile: NewAgentProfile(
            name: "Archivist",
            title: "Keeps the record",
            description: "Preserve decisions and their evidence.",
            spirit: "signal",
            spiritPalette: "lunar",
            spiritGeometry: "constellation",
            spiritTemperament: "focused",
            color: "blue"
        ))

        let request = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/bots")
        let data = try XCTUnwrap(ProfileRequestStub.capturedBody)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(body["name"] as? String, "Archivist")
        XCTAssertEqual(body["title"] as? String, "Keeps the record")
        XCTAssertEqual(body["description"] as? String, "Preserve decisions and their evidence.")
        XCTAssertEqual(body["spirit"] as? String, "signal")
        XCTAssertEqual(body["spiritPalette"] as? String, "lunar")
        XCTAssertEqual(body["spiritGeometry"] as? String, "constellation")
        XCTAssertEqual(body["spiritTemperament"] as? String, "focused")
        XCTAssertEqual(body["color"] as? String, "blue")
    }

    func testRoleLibraryComesFromThePairedHarness() async throws {
        ProfileRequestStub.responseBody = Data("""
        {"templates":[{
          "id":"project-steward","name":"Project Steward","title":"Project State Steward",
          "summary":"Keeps project truth current.","category":"coordination","origin":"janua",
          "description":"OWNS\\nProject state"
        }]}
        """.utf8)

        let templates = try await client.agentRoleTemplates()

        let request = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/agent-role-templates")
        XCTAssertEqual(templates.map(\.id), ["project-steward"])
        XCTAssertEqual(templates.first?.origin, "janua")
    }

    func testProfileClientEncodesAnExplicitAvatarClearAsNull() async throws {
        ProfileRequestStub.responseBody = Self.botResponse

        _ = try await client.updateProfile(
            botId: "avatar-bot",
            patch: BotProfilePatch(avatarUrl: .clear, avatarCrop: .mascot)
        )

        _ = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        let data = try XCTUnwrap(ProfileRequestStub.capturedBody)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(body.keys.sorted(), ["avatarCrop", "avatarUrl"])
        XCTAssertTrue(body["avatarUrl"] is NSNull)
        XCTAssertEqual(body["avatarCrop"] as? String, "mascot")
    }

    func testAvatarGenerationRequestOutlivesTheServersImageTimeout() async throws {
        ProfileRequestStub.responseBody = Self.generatedAvatarResponse

        _ = try await client.generateAvatar(botId: "avatar-bot", prompt: "Friendly researcher")

        let request = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        XCTAssertGreaterThan(request.timeoutInterval, 120)
    }

    func testMailDraftLoadsFromTheExactReceipt() async throws {
        ProfileRequestStub.responseBody = Self.mailDraftResponse

        let action = try await client.mailDraft(receiptId: "receipt-old")

        let request = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/mail-actions/receipt-old/draft")
        XCTAssertEqual(action.draft.subject, "Farmada questionnaire")
        XCTAssertEqual(action.draft.to, ["farmada@example.com"])
    }

    func testMailDraftRevisionCarriesTheEditedBytesAndLearningChoice() async throws {
        ProfileRequestStub.responseBody = Self.mailDraftResponse
        let revised = MailDraft(
            fromAccount: "doorsofjanua@gmail.com",
            to: ["farmada@example.com"],
            cc: [],
            bcc: [],
            subject: "Farmada questionnaire — revised",
            body: "This is my edited reply."
        )

        _ = try await client.reviseMailDraft(
            receiptId: "receipt-old",
            draft: revised,
            learnStyle: true
        )

        let request = try XCTUnwrap(ProfileRequestStub.capturedRequest)
        XCTAssertEqual(request.httpMethod, "PUT")
        XCTAssertEqual(request.url?.path, "/api/mail-actions/receipt-old/draft")
        let data = try XCTUnwrap(ProfileRequestStub.capturedBody)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(body["learnStyle"] as? Bool, true)
        let draft = try XCTUnwrap(body["draft"] as? [String: Any])
        XCTAssertEqual(draft["subject"] as? String, "Farmada questionnaire — revised")
        XCTAssertEqual(draft["body"] as? String, "This is my edited reply.")
        XCTAssertEqual(draft["attachments"] as? [String], [])
    }

    private static let botJSON = """
    {
      "id":"avatar-bot","threadId":"avatar-thread","name":"Scout","title":"Researcher",
      "description":"Finds evidence.","notifications":true,"color":"blue",
      "avatarUrl":"/api/attachments/123e4567-e89b-12d3-a456-426614174000.webp",
      "avatarCrop":"rounded","unread":false,
      "modelSelection":{"instanceId":"local","model":"default"},"createdAt":1786742441013
    }
    """

    private static let botResponse = Data("{\"bot\":\(botJSON)}".utf8)
    private static let generatedAvatarResponse = Data(
        "{\"avatarUrl\":\"/api/attachments/123e4567-e89b-12d3-a456-426614174000.webp\",\"bot\":\(botJSON)}".utf8
    )

    private static let mailDraftResponse = Data("""
    {
      "action": {
        "receiptId": "receipt-new",
        "botId": "mailman",
        "threadId": "mail-thread",
        "draft": {
          "fromAccount": "doorsofjanua@gmail.com",
          "to": ["farmada@example.com"],
          "cc": [],
          "bcc": [],
          "subject": "Farmada questionnaire",
          "body": "Draft body",
          "attachments": []
        },
        "draftHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "state": "pending",
        "createdAt": "2026-08-23T12:00:00.000Z",
        "updatedAt": "2026-08-23T12:00:00.000Z"
      },
      "style": {"learned": true, "sampleCount": 1}
    }
    """.utf8)
}
