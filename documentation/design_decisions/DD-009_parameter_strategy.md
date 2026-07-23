# DD-009: Parameter Strategy (Profiles vs. System Security Plans)

## Status: Accepted
## Date: 2026-07-20
## Decision Makers: Development Team

## Context
In OSCAL, security controls in catalogs contain **parameters** (representing "controlled parameter values" or variables). According to the official NIST OSCAL guidelines:
> *"Typically, a catalog will expose parameters where applications that implement profile resolution are expected either to define appropriate values themselves (that is, values appropriate to a baseline) or to permit setting at higher levels of implementation (such as system plans implementing a baseline)."*

In a compliance management workspace like Reposol, we need a clear and consistent architectural strategy determining:
1. Whether these parameters should be defined/configured in the **Profile** (e.g., standard baseline).
2. Or whether they should be deferred to the **System Security Plan (SSP)** (e.g., specific system implementation).

---

## Decisions

### 1. Hybrid Parameter Strategy
We adopt a hybrid strategy aligning with the official NIST OSCAL specification and life-cycle layers:

1. **Profile-Level Parameter Tailoring (modify.set-parameters):**
   - **Baseline-wide/Regulatory requirements:** Parameter values that are dictated by a standard or governing baseline (e.g., "Minimum password length must be 12 characters" in a High baseline) must be set at the Profile level.
   - **Setting Constraints/Options:** Profile authors can define options using `<select>` or restrict parameters using `<constraint>`.
   - **Label/Usage Tailoring:** Clarifying or narrowing the scope/labels of parameters is done in the Profile.

2. **Component-Level Parameter Tailoring (component-definition):**
   - Software/service providers define component-specific values (e.g., a specific database component defaults to port 5432).

3. **SSP-Level Parameter Overrides & Finalization (ssp.control-implementation):**
   - **System-specific configuration:** Any system-specific variables (e.g., "Company XYZ's password length is 14") must be configured at the SSP level.
   - **Resolution of Open Parameters:** Any parameter left unassigned (open) by the underlying Profile baseline or Component Definition must be finalized in the SSP.
   - **Local Overrides:** System owners can override profile-set parameters where local deviations are permitted.

---

## Rationale
- **Compliance Baseline Separation:** Separating the regulatory baseline (Profile) from system implementation (SSP) allows one profile (e.g., NIST SP 800-53 Moderate) to be reused across many different systems, each having their own unique SSP.
- **Standards Alignment:** This separation matches the core design goals of the NIST OSCAL schema.
- **Traceability:** Unresolved parameters are flagged during SSP generation, preventing incomplete system plans.

---

## Consequences
- The Profile editor in Reposol supports parameter customization and serialization under `modify.set-parameters`.
- The SSP editor resolves baseline controls recursively (using `resolveProfileSync()`) and alerts users during the saving process if any parameters are left unresolved (have neither a default value in the baseline nor an override value in the SSP).
