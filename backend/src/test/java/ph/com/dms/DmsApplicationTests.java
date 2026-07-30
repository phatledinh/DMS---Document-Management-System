package ph.com.dms;

import com.dms.DmsApplication;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DmsApplicationTests {

    @Test
    void applicationClass_exists() {
        assertThat(DmsApplication.class).isNotNull();
    }
}
