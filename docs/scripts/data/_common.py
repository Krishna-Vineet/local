"""Shared helpers for the backend reference data.

The reference is generated, not hand-written, so that 130+ endpoints, 23 models,
10 services and the middleware chain stay consistent with one shape. Each data
module exposes plain data; the renderer owns all presentation.
"""

from __future__ import annotations


def ep(method, path, summary, *, auth="jwt", perm=None, rl=None,
       body=None, query=None, res=None, errors=None, uses=None,
       note=None, side=None):
    """Describe one endpoint.

    body / query / res / errors / uses are lists of tuples:
        body  : (field, type, description, "required"|"optional")
        res   : (field, type, description)
        errors: (status + code, when it happens)
        uses  : collection, service, util or external dependency name
    """
    return {
        "method": method.upper(),
        "path": path,
        "summary": summary,
        "auth": auth,
        "perm": perm,
        "rl": rl,
        "body": body or [],
        "query": query or [],
        "res": res or [],
        "errors": errors or [],
        "uses": uses or [],
        "note": note,
        "side": side,
    }


def router(name, base, module, summary, *, auth, endpoints, notes=None):
    return {
        "name": name,
        "base": base,
        "module": module,
        "summary": summary,
        "auth": auth,
        "endpoints": endpoints,
        "notes": notes or [],
    }
