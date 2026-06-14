// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Thrown when a required address parameter is the zero address.
error ZeroAddress();
/// @notice Thrown when a required amount parameter is zero.
error ZeroAmount();
/// @notice Thrown when the caller lacks the required authority.
error Unauthorized();
/// @notice Thrown when paired arrays do not share the same length.
error InvalidArrayLength();
/// @notice Thrown when a round lifecycle transition is invalid for the current state.
error InvalidRoundStatus();
/// @notice Thrown when round timestamps are malformed.
error InvalidTimestamp();
/// @notice Thrown when a submitted execution result or bounded numeric value is invalid.
error InvalidResult();
/// @notice Thrown when a submitted rank is outside the allowed range.
error InvalidRank();
/// @notice Thrown when a result payload contains a duplicate rank.
error DuplicateRank();
/// @notice Thrown when an agent id or agent payload is invalid.
error InvalidAgent();
/// @notice Thrown when an agent cannot participate because it is inactive.
error AgentNotActive();
/// @notice Thrown when an action references an agent that is not part of the round.
error AgentNotInRound();
/// @notice Thrown when an agent attempts to join the same round twice.
error AgentAlreadyInRound();
/// @notice Thrown when round settlement is attempted twice for the same agent.
error AgentAlreadySettled();
/// @notice Thrown when an operation requires the round to be closed but it is still open.
error RoundStillOpen();
/// @notice Thrown when an operation requires an open round but none is available.
error RoundNotOpen();
/// @notice Thrown when settlement is attempted before the round is locked.
error RoundNotLocked();
/// @notice Thrown when a claim or read requires a settled round.
error RoundNotSettled();
/// @notice Thrown when result submission is attempted more than once per round.
error ResultAlreadySubmitted();
/// @notice Thrown when a one-time claim or action has already been consumed.
error AlreadyClaimed();
/// @notice Thrown when no claimable reward exists for the caller or target.
error NoClaimableReward();
/// @notice Thrown when a round has fewer participants than the configured minimum.
error MinimumParticipantsNotMet();
/// @notice Thrown when a creator bond is below the required active threshold.
error BondBelowMinimum();
/// @notice Thrown when caller attempts to write to a protected metadata key.
error ReservedMetadataKey();
/// @notice Thrown when an agent attempts to write reputation feedback about itself.
error SelfFeedbackNotAllowed();
/// @notice Thrown when the requested feedback record does not exist.
error FeedbackNotFound();
/// @notice Thrown when a validation request hash is reused.
error ValidationAlreadyExists();
/// @notice Thrown when a validation request hash cannot be found.
error ValidationNotFound();
/// @notice Thrown when a requested treasury backstop would exceed the configured cap.
error BackstopCapExceeded();
