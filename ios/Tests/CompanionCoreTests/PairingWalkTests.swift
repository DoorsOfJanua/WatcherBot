import XCTest
@testable import CompanionCore

final class PairingWalkTests: XCTestCase {
    private func connection(hosts: [String]) -> Connection {
        var c = Connection(id: "c1", name: "Mac", host: hosts[0], port: 8810)
        c.hosts = hosts
        return c
    }

    func testWalksPastAStaleAddressToTheOneThatWorks() async throws {
        let invite = connection(hosts: ["dead.ts.net", "192.168.0.9", "192.168.1.101"])
        var dialed: [String] = []
        let outcome = try await PairingWalk.redeem(connection: invite) { candidate in
            dialed.append(candidate.host)
            switch candidate.host {
            case "dead.ts.net": throw URLError(.cannotFindHost)
            case "192.168.0.9": throw URLError(.timedOut)
            default: return "token"
            }
        }
        XCTAssertEqual(outcome.result, "token")
        XCTAssertEqual(outcome.connection.host, "192.168.1.101")
        XCTAssertEqual(dialed, ["dead.ts.net", "192.168.0.9", "192.168.1.101"])
    }

    func testANonAddressFailureStopsTheWalkImmediately() async {
        struct BadCode: Error {}
        let invite = connection(hosts: ["a", "b"])
        var dialed: [String] = []
        do {
            _ = try await PairingWalk.redeem(connection: invite) { candidate -> String in
                dialed.append(candidate.host)
                throw BadCode() // a wrong code fails the same on every address
            }
            XCTFail("expected the walk to throw")
        } catch {
            XCTAssertTrue(error is BadCode)
        }
        XCTAssertEqual(dialed, ["a"])
    }

    func testEveryAddressFailingSurfacesTheLastAddressError() async {
        let invite = connection(hosts: ["a", "b"])
        do {
            _ = try await PairingWalk.redeem(connection: invite) { _ -> String in
                throw URLError(.cannotConnectToHost)
            }
            XCTFail("expected the walk to throw")
        } catch let error as URLError {
            XCTAssertEqual(error.code, .cannotConnectToHost)
        } catch {
            XCTFail("expected a URLError, got \(error)")
        }
    }
}
