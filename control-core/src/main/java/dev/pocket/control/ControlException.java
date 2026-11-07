package dev.pocket.control;

public final class ControlException extends Exception {
    public enum Code {
        NOT_READY, PERMISSION_REQUIRED, SCREEN_OFF, LOCKED, STALE_OBSERVATION,
        INVALID_ARGUMENT, UNSUPPORTED, AMBIGUOUS_TARGET, ACTION_REJECTED, RESULT_UNKNOWN
    }
    public final Code code;
    public final boolean notDispatched;
    public ControlException(Code code, String message) { this(code,message,false); }
    public ControlException(Code code, String message, boolean notDispatched) {
        super(message);
        this.code=code;
        this.notDispatched=notDispatched;
    }
}
