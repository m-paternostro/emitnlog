---
'emitnlog': minor
---

This change includes some significant improvements to the packing of the project and a breaking change for users.

Users no longer need to explicitly import from the `node` subpath. The correct runtime variant (neutral or Node-specific) is now automatically resolved based on the environment. This simplifies usage but may affect setups that previously relied on manually selecting the Node export.
