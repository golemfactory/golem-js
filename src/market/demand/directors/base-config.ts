/**
 * Basic config utility class
 *
 * Helps in building more specific config classes
 */
export class BaseConfig {
  protected isPositiveInt(value: number) {
    return value > 0 && Number.isInteger(value);
  }
}
