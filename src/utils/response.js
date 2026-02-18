export function respond(res, data, status = 200) {
    return res.status(status).json({ success: true, data });
}

export function respondError(res, error, status = 400) {
    return res.status(status).json({ success: false, error });
}
