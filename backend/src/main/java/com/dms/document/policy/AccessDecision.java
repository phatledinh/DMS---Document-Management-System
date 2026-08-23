package com.dms.document.policy;

public record AccessDecision(boolean granted, String denialReason) {
    public static AccessDecision allow() {
        return new AccessDecision(true, null);
    }

    public static AccessDecision denied(String denialReason) {
        return new AccessDecision(false, denialReason);
    }
}
