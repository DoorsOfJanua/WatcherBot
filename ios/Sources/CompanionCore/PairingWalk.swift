import Foundation

/// Pairing with late binding, like the live session already has.
///
/// The invite carries every address the computer answered on, but a redeem
/// that dials only the first candidate dies on a stale one — a Tailscale
/// name this phone cannot resolve right now, a LAN address from a network
/// the computer has since left — while a working road sits right next to it
/// in the list. (2026-08-25: exactly this left a phone unable to re-pair
/// even though Safari could open the companion's LAN address.)
///
/// Only address-shaped failures advance the walk; anything else — a wrong
/// or expired code, an auth refusal — would repeat identically on every
/// address and is thrown immediately.
public enum PairingWalk {
    public static func redeem<Redeemed>(
        connection: Connection,
        using redeem: (Connection) async throws -> Redeemed
    ) async throws -> (result: Redeemed, connection: Connection) {
        var lastAddressFailure: URLError?
        for candidate in connection.orderedHosts {
            let dialed = connection.dialing(candidate)
            do {
                return (try await redeem(dialed), dialed)
            } catch let error as URLError where ConnectionAdvice.shouldTryAnotherHost(error.code) {
                lastAddressFailure = error
            }
        }
        throw lastAddressFailure ?? URLError(.cannotConnectToHost)
    }
}
