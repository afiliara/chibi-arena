// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IM2AgentRegistry} from "./interfaces/IM2AgentRegistry.sol";
import "./common/M2Errors.sol";

/// @title M2ValidationRegistry
/// @notice ERC-8004-aligned validation registry for agent review and attestation flows.
contract M2ValidationRegistry is AccessControl {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    IM2AgentRegistry public immutable identityRegistry; // immutable: validation is anchored to one identity registry throughout the contract lifecycle.

    struct ValidationStatus {
        address validator;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool hasResponse;
    }

    mapping(bytes32 => ValidationStatus) private validations;
    mapping(uint256 => bytes32[]) private validationsByAgent;
    mapping(address => bytes32[]) private requestsByValidator;

    event ValidationRequested(
        address indexed requester, address indexed validator, uint256 agentId, bytes32 requestHash, string requestURI
    );
    event ValidationResponded(
        address indexed validator,
        uint256 agentId,
        bytes32 requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    /// @notice Deploys the ERC-8004-aligned validation registry.
    /// @param admin Address receiving admin and validator management rights.
    /// @param identityRegistry_ Agent registry that anchors valid agent ids.
    constructor(address admin, address identityRegistry_) {
        if (admin == address(0) || identityRegistry_ == address(0)) revert ZeroAddress();
        identityRegistry = IM2AgentRegistry(identityRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Opens a validation request for an agent.
    /// @param validator Address expected to answer the validation request.
    /// @param agentId The agent identity token id.
    /// @param requestURI Optional URI describing the validation context.
    /// @param requestHash Unique request hash.
    function validationRequest(address validator, uint256 agentId, string calldata requestURI, bytes32 requestHash)
        external
    {
        if (validator == address(0)) revert ZeroAddress();
        if (!identityRegistry.isAuthorizedOrOwner(msg.sender, agentId)) revert Unauthorized();
        if (validations[requestHash].validator != address(0)) revert ValidationAlreadyExists();

        validations[requestHash] = ValidationStatus({
            validator: validator,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp,
            hasResponse: false
        });

        validationsByAgent[agentId].push(requestHash);
        requestsByValidator[validator].push(requestHash);

        emit ValidationRequested(msg.sender, validator, agentId, requestHash, requestURI);
    }

    /// @notice Answers a validation request.
    /// @param requestHash Request hash being answered.
    /// @param response Validation score from 0 to 100.
    /// @param responseURI Optional URI carrying the detailed response.
    /// @param responseHash Hash of the detailed response payload.
    /// @param tag Validation tag used for aggregation.
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationStatus storage status = validations[requestHash];
        if (status.validator == address(0)) revert ValidationNotFound();
        if (msg.sender != status.validator && !hasRole(VALIDATOR_ROLE, msg.sender)) revert Unauthorized();
        if (response > 100) revert InvalidResult();

        status.response = response;
        status.responseHash = responseHash;
        status.tag = tag;
        status.lastUpdate = block.timestamp;
        status.hasResponse = true;

        emit ValidationResponded(msg.sender, status.agentId, requestHash, response, responseURI, responseHash, tag);
    }

    /// @notice Returns the current validation status for a request hash.
    /// @param requestHash Request hash to inspect.
    /// @return status Stored validation status.
    function getValidationStatus(bytes32 requestHash) external view returns (ValidationStatus memory status) {
        status = validations[requestHash];
        if (status.validator == address(0)) revert ValidationNotFound();
    }

    /// @notice Lists all validation request hashes associated with an agent.
    /// @param agentId The agent identity token id.
    /// @return requestHashes Validation request hashes.
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory requestHashes) {
        requestHashes = validationsByAgent[agentId];
    }

    /// @notice Lists all validation request hashes assigned to a validator.
    /// @param validator Validator address to inspect.
    /// @return requestHashes Validation request hashes.
    function getValidatorRequests(address validator) external view returns (bytes32[] memory requestHashes) {
        requestHashes = requestsByValidator[validator];
    }
}
